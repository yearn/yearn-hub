import {
    Multicall,
    ContractCallResults,
    ContractCallContext,
} from 'ethereum-multicall';
import { BigNumber, utils } from 'ethers';
import { BigNumber as BigNumberJS } from 'bignumber.js';
import { get, memoize } from 'lodash';
import { getEthersDefaultProvider } from './ethers';
import { Vault, VaultApi, VaultVersion, Strategy } from '../types';
import { BuildGet } from './apisRequest';
import { vaultChecks } from './checks';
import {
    mapContractCalls,
    createStrategiesHelperCallAssetStrategiesAddresses,
    mapToStrategyAddressQueueIndex,
} from './commonUtils';
import { toHumanDateText } from './dateUtils';
import { getABI_032 } from './abi';
import { mapStrategiesCalls, buildStrategyCalls } from './strategies';
import { getTotalDebtUsage } from './strategyParams';

const VAULT_VIEW_METHODS = [
    'management',
    'managementFee',
    'performanceFee',
    'governance',
    'guardian',
    'depositLimit',
    'totalAssets',
    'debtRatio',
    'totalDebt',
    'lastReport',
    'rewards',
];

type VaultData = {
    apiVersion?: string;
    version?: string;
};

// this list is for testing or debugging an issue when loading vault data
const FILTERED_VAULTS: Set<string> = new Set(
    [
        // '0xe2F6b9773BF3A015E2aA70741Bde1498bdB9425b',
        // '0xBFa4D8AA6d8a379aBFe7793399D3DdaCC5bBECBB',
    ].map((addr: string) => addr.toLowerCase())
);

const hasValidVersion = (vault: VaultData): boolean => {
    if (vault.apiVersion && vault.apiVersion.startsWith('0.2')) {
        return false;
    }

    if (vault.version && vault.version.startsWith('0.2')) {
        return false;
    }

    return true;
};

const filterAndMapVaultsData = (
    data: any,
    additional: Set<string> = new Set<string>()
): VaultApi[] => {
    const vaultData: VaultApi[] = data
        .filter(
            (vault: any) =>
                (vault.endorsed &&
                    vault.type.toLowerCase() === VaultVersion.V2 &&
                    hasValidVersion(vault) &&
                    !FILTERED_VAULTS.has(vault.address.toLowerCase())) ||
                additional.has(vault.address.toLowerCase())
        )
        .map((vault: any) => {
            return {
                ...vault,
                apiVersion: vault.version,
                name: vault.display_name,
                emergencyShutdown: vault.emergency_shutdown,
                tvl: {
                    totalAssets: BigNumber.from(
                        new BigNumberJS(
                            vault.tvl.total_assets.toString()
                        ).toFixed(0)
                    ),
                },
            } as VaultApi;
        });
    // DEV NOTE: this is a helper method from debug.ts for debugging the data, should do nothing in prod
    // vaultData = debugFilter(vaultData);

    return vaultData;
};

const vaultsAreMissing = (
    vaultMap: Map<string, VaultApi>,
    additional: Set<string>
): boolean => {
    let missing = false;
    additional.forEach((vaultAddr) => {
        if (vaultMap.has(vaultAddr.toLowerCase()) === false) {
            missing = true;
        }
    });

    return missing;
};

const internalGetVaults = async (
    allowList: string[] = []
): Promise<Vault[]> => {
    const provider = getEthersDefaultProvider();

    const multicall = new Multicall({ ethersProvider: provider });
    // accepts non endorsed experimental vaults to access
    const additional = new Set(allowList.map((addr) => addr.toLowerCase()));

    const response = await BuildGet('/vaults/all');
    const payload: VaultApi[] = filterAndMapVaultsData(
        response.data,
        additional
    );

    const vaultMap = new Map<string, VaultApi>();
    const strategyMap = new Map<string, string>();

    payload.forEach((vault) => {
        vaultMap.set(vault.address, vault);
        vault.strategies.forEach((strat) =>
            strategyMap.set(strat.address, vault.address)
        );
    });

    // TODO: uncomment and improve this
    // // check if we have missing vaults from requested
    // if (vaultsAreMissing(vaultMap, additional)) {
    //     // need to fetch experimental data
    //     console.log('...fetching experimental vaults data');
    //     const response = await BuildGetExperimental('/vaults/all');
    //     const experimentalPayload: VaultApi[] = filterAndMapVaultsData(
    //         response.data,
    //         additional
    //     );
    //     experimentalPayload.forEach((vault) => {
    //         vaultMap.set(vault.address, vault);
    //         vault.strategies.forEach((strat) =>
    //             strategyMap.set(strat.address, vault.address)
    //         );
    //     });
    // }

    const vaultCalls: ContractCallContext[] = payload.map(({ address }) => {
        const calls = VAULT_VIEW_METHODS.map((method) => ({
            reference: method,
            methodName: method,
            methodParameters: [],
        }));
        return {
            reference: address,
            contractAddress: address,
            abi: getABI_032(), // only this abi version has the vault view methods
            calls,
        };
    });
    const stratCalls: ContractCallContext[] = payload.flatMap(
        ({ strategies }) => {
            const stratAddresses = strategies.map(({ address }) => address);
            return buildStrategyCalls(stratAddresses, vaultMap, strategyMap);
        }
    );
    const strategiesHelperCallResults: ContractCallResults = await multicall.call(
        createStrategiesHelperCallAssetStrategiesAddresses(payload)
    );
    const results: ContractCallResults = await multicall.call(
        vaultCalls.concat(stratCalls)
    );

    return mapVaultData(
        results,
        strategiesHelperCallResults,
        vaultMap,
        strategyMap
    );
};

export const getVaults = memoize(internalGetVaults);

const _getVault = async (address: string): Promise<Vault> => {
    if (!address || !utils.isAddress(address)) {
        throw new Error('Expected a valid vault address');
    }

    const vaults = await getVaults();

    const [foundVault]: Vault[] = vaults.filter(
        (vault) => vault.address.toLowerCase() === address.toLowerCase()
    );

    if (!foundVault) {
        throw new Error('Requested address not recognized as a yearn vault');
    }

    return foundVault;
};

export const getVault = memoize(_getVault);

const mapVaultData = (
    contractCallsResults: ContractCallResults,
    strategiesHelperCallsResults: ContractCallResults,
    vaultMap: Map<string, VaultApi>,
    strategyMap: Map<string, string>
): Vault[] => {
    const vaults: Vault[] = [];

    vaultMap.forEach((vault, key) => {
        const {
            address,
            apiVersion,
            symbol,
            name,
            token,
            icon,
            emergencyShutdown,
            strategies,
        } = vault;

        const strategiesQueueIndexes = mapToStrategyAddressQueueIndex(
            address,
            strategiesHelperCallsResults
        );

        const mappedVault: any = {
            address,
            apiVersion,
            symbol,
            name,
            token,
            icon,
            emergencyShutdown,
        };

        const stratAddresses = strategies.map(({ address }) => address);
        const mappedStrategies: Strategy[] = mapStrategiesCalls(
            stratAddresses,
            contractCallsResults,
            strategiesQueueIndexes,
            strategyMap
        );

        mappedVault.debtUsage = getTotalDebtUsage(mappedStrategies);

        const vaultData = contractCallsResults.results[address];

        const mappedVaultContractCalls = mapContractCalls(vaultData);
        const mappedVaultContractCallsConverted = {
            ...mappedVaultContractCalls,
            managementFee: parseInt(mappedVaultContractCalls.managementFee),
            performanceFee: parseInt(mappedVaultContractCalls.performanceFee),
        };

        mappedVault.lastReportText = toHumanDateText(
            mappedVaultContractCalls.lastReport
        );

        vaults.push(
            vaultChecks({
                ...mappedVault,
                ...mappedVaultContractCallsConverted,
                strategies: mappedStrategies,
            })
        );
    });

    return vaults;
};
