import { type Alert, type AlertContent, type ErrorGroup } from '../models';

export interface AlertProviderInterface {
  findAlert(clientId: string): Promise<Alert | undefined>;

  createAlert(alertContent: AlertContent): Promise<Alert>;

  updateAlert(alert: Alert): Promise<Alert>;

  closeAlert(alert: Alert): Promise<void>;

  generateAlertContent(errorGroup: ErrorGroup): Promise<AlertContent>;
}
