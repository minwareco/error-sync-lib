import { Alert, AlertContent, ErrorGroup } from '../models';
import { AlertProviderInterface } from '../interfaces';
export declare type OpsGenieAlertProviderConfig = {
    host: string;
    apiKey: string;
    priorityMap?: object;
};
export declare class OpsGenieAlertProvider implements AlertProviderInterface {
    private config;
    constructor(config: OpsGenieAlertProviderConfig);
    findAlert(clientId: string): Promise<Alert>;
    createAlert(alertContent: AlertContent): Promise<Alert>;
    updateAlert(alert: Alert): Promise<Alert>;
    generateAlertContent(errorGroup: ErrorGroup): Promise<AlertContent>;
}
