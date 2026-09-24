import { type Alert, type AlertContent, type ErrorGroup } from '../models';
import { type AlertProviderInterface } from '../interfaces';
export type OpsGenieAlertProviderConfig = {
    host: string;
    apiKey: string;
    priorityMap?: Record<string, string>;
};
export declare class OpsGenieAlertProvider implements AlertProviderInterface {
    private config;
    constructor(config: OpsGenieAlertProviderConfig);
    findAlert(clientId: string): Promise<Alert | undefined>;
    createAlert(alertContent: AlertContent): Promise<Alert>;
    updateAlert(alert: Alert): Promise<Alert>;
    closeAlert(alert: Alert): Promise<void>;
    generateAlertContent(errorGroup: ErrorGroup): Promise<AlertContent>;
}
