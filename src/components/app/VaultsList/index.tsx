import { Theme, createStyles, makeStyles } from '@material-ui/core/styles';
import { Container } from '@material-ui/core';
import MuiAccordion from '@material-ui/core/Accordion';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import Avatar from '@material-ui/core/Avatar';
import ListItemAvatar from '@material-ui/core/ListItemAvatar';
import Divider from '@material-ui/core/Divider';
import { Vault } from '../../../types';
import { StrategistList } from '../StrategistList';
import EtherScanLink from '../../common/EtherScanLink';

import Grid from '@material-ui/core/Grid';
import Hidden from '@material-ui/core/Hidden';
type VaultsListProps = {
    vault: Vault;
    key: number;
};

export const VaultsList = (props: VaultsListProps) => {
    const { vault } = props;
    const config = vault.configOK;

    const useStyles = makeStyles((theme: Theme) =>
        createStyles({
            root: {
                width: '100%',
                margin: '5px',
                borderRadius: '5px',
            },
            link: {
                color: '#fff',
                textDecoration: 'none',
            },
            textVault: {
                fontFamily: 'Open Sans',
                lineHeight: '27px',
                fontSize: '18px',
            },

            expandIcon: {
                color: '#fff',
            },
            list: {
                padding: 0,
            },
            alert: {
                background: 'transparent',
                color: '#006ae3',
                fontWeight: 400,
            },

            divider: {
                background: '#fff',
                opacity: '0.3',
                marginLeft: '10px',
                marginRight: '10px',
            },
            accordion: {
                background: config ? '#0a1d3f' : '#006ae3',
                borderRadius: '8px',
                color: '#ffffff',
                '&:hover': {
                    background: config ? '#0a1d3f' : '#006ae3',
                    opacity: '0.9',
                },
            },
            heading: {
                fontSize: theme.typography.pxToRem(15),
                fontWeight: theme.typography.fontWeightRegular,
            },
            paper: {
                padding: theme.spacing(2),
            },
        })
    );

    const classes = useStyles();

    return (
        <div className={classes.root}>
            <MuiAccordion className={classes.accordion}>
                <AccordionSummary
                    expandIcon={
                        <ExpandMoreIcon className={classes.expandIcon} />
                    }
                    aria-controls="panel1a-content"
                    id="panel1a-header"
                >
                    <Grid container className={classes.root} spacing={2}>
                        <Grid item md={12} xs={12}>
                            <Grid
                                container
                                spacing={1}
                                direction="row"
                                justify="center"
                                alignItems="center"
                            >
                                <Grid item md={1} xs={3}>
                                    {vault && vault.icon ? (
                                        <ListItemAvatar>
                                            {
                                                <Avatar
                                                    alt={vault.icon}
                                                    src={vault.icon}
                                                />
                                            }
                                        </ListItemAvatar>
                                    ) : (
                                        <ListItemAvatar>
                                            <Avatar
                                                style={{
                                                    color: 'transparent',
                                                }}
                                            >
                                                .
                                            </Avatar>
                                        </ListItemAvatar>
                                    )}
                                </Grid>
                                <Grid item md={3} xs={9}>
                                    <a
                                        className={classes.link}
                                        href={`/vault/${vault.address}`}
                                    >
                                        <span className={classes.textVault}>
                                            {' '}
                                            {vault.name}{' '}
                                        </span>
                                    </a>
                                </Grid>

                                <Hidden xsDown>
                                    {' '}
                                    <Grid item md={8} xs={12}>
                                        {' '}
                                        <EtherScanLink
                                            address={vault.address}
                                            dark={true}
                                        />
                                    </Grid>
                                </Hidden>
                            </Grid>
                        </Grid>
                    </Grid>
                </AccordionSummary>
                <Hidden smUp>
                    <Grid container className={classes.root} spacing={2}>
                        <Grid item md={8} xs={12}>
                            {' '}
                            <EtherScanLink
                                address={vault.address}
                                dark={true}
                            />
                        </Grid>
                    </Grid>
                </Hidden>
                <Divider className={classes.divider} />
                <AccordionDetails>
                    <Container>
                        <StrategistList vault={vault} dark={false} />
                    </Container>
                </AccordionDetails>
            </MuiAccordion>
        </div>
    );
};
