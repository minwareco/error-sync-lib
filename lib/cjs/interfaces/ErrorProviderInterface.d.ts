import { Error } from '../models';
export interface ErrorProviderInterface {
    getErrors(hoursBack: number, limit: number): Promise<Error[]>;
}
