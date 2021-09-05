import { ErrorGroup, Alert, AlertContent } from '../models';
export interface AlertProviderInterface {
    findAlert(clientId: string): Promise<Alert>;
    createAlert(alertContent: AlertContent): Promise<Alert>;
    updateAlert(alert: Alert): Promise<Alert>;
    generateAlertContent(errorGroup: ErrorGroup): Promise<AlertContent>;
}
