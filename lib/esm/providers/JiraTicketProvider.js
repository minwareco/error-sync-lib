var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { ErrorPriority } from '../models';
const JiraApi = require('jira-client');
export class JiraTicketProvider {
    constructor(config) {
        this.config = config;
        if (!this.config.ticket.priorityMap) {
            this.config.ticket.priorityMap = {
                [ErrorPriority.P1]: 'Highest',
                [ErrorPriority.P2]: 'High',
                [ErrorPriority.P3]: 'Medium',
                [ErrorPriority.P4]: 'Low',
                [ErrorPriority.P5]: 'Lowest',
            };
        }
        let jiraClientConfig = {
            protocol: 'https',
            host: this.config.host,
            apiVersion: '2',
            strictSSL: true,
        };
        if (this.config.basicAuth) {
            jiraClientConfig.username = this.config.basicAuth.username;
            jiraClientConfig.password = this.config.basicAuth.apiKey;
        }
        else if (this.config.oauth) {
            jiraClientConfig.oauth = {
                consumer_key: this.config.oauth.consumerKey,
                consumer_secret: this.config.oauth.consumerSecret,
                access_token: this.config.oauth.accessToken,
                access_token_secret: this.config.oauth.accessTokenSecret,
            };
        }
        else {
            throw new Error('JiraTicketProvider configuration must specify either the \'basicAuth\' or \'oauth\' property');
        }
        this.jiraClient = new JiraApi(jiraClientConfig);
    }
    findTicket(clientId) {
        return __awaiter(this, void 0, void 0, function* () {
            const jql = `labels = "error:${clientId}"`;
            const jiraResults = yield this.jiraClient.searchJira(jql);
            if (jiraResults.total == 0) {
                return undefined;
            }
            const jiraTicket = jiraResults.issues[0];
            return {
                id: jiraTicket.id,
                clientId,
                url: this.makeTicketUrl(jiraTicket.key),
                summary: jiraTicket.fields.summary,
                priority: jiraTicket.fields.priority.name,
                description: jiraTicket.fields.description,
                labels: jiraTicket.fields.labels,
                isOpen: jiraTicket.fields.resolution === null,
                resolutionDate: jiraTicket.fields.resolution,
            };
        });
    }
    createTicket(ticketContent) {
        return __awaiter(this, void 0, void 0, function* () {
            const jiraTicketRequest = {
                fields: {
                    project: { key: this.config.ticket.projectId },
                    summary: ticketContent.summary,
                    description: ticketContent.description,
                    issuetype: {
                        id: this.config.ticket.issueTypeId,
                    },
                    labels: ticketContent.labels,
                    priority: {
                        name: ticketContent.priority
                    },
                },
                transition: {
                    id: this.config.ticket.openTransitionId,
                },
            };
            if (this.config.ticket.components) {
                let components = [];
                for (const componentId in this.config.ticket.componentIds) {
                    components.push({ id: componentId });
                }
                jiraTicketRequest.components = components;
            }
            const jiraTicket = yield this.jiraClient.addNewIssue(jiraTicketRequest);
            return Object.assign(ticketContent, {
                id: jiraTicket.id,
                url: this.makeTicketUrl(jiraTicket.key),
                isOpen: true,
                resolutionDate: undefined,
            });
        });
    }
    updateTicket(ticket) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.jiraClient.updateIssue(ticket.id, {
                fields: {
                    summary: ticket.summary,
                    description: ticket.description,
                    priority: {
                        name: ticket.priority
                    },
                },
            }, {
                notifyUsers: false,
            });
            return this.findTicket(ticket.clientId);
        });
    }
    reopenTicket(ticket) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.jiraClient.transitionIssue(ticket.id, {
                transition: {
                    id: this.config.ticket.openTransitionId,
                },
            });
            return this.findTicket(ticket.clientId);
        });
    }
    generateTicketContent(errorGroup) {
        return __awaiter(this, void 0, void 0, function* () {
            const maxInstances = 10;
            const summary = `[${errorGroup.type}] ${errorGroup.name}`;
            let description = errorGroup.name +
                '\n\nh3.Frequency' +
                `${errorGroup.count} ${errorGroup.countType} per day` +
                '\n\nh3.Instances';
            for (const instance of errorGroup.instances.slice(0, maxInstances)) {
                description += `${instance.name}\n\nTroubleshoot at: [${instance.debugUrl}]`;
            }
            if (errorGroup.instances.length > 10) {
                const additional = (errorGroup.instances.length - maxInstances);
                description += `\n\n_...${additional} older instances not shown_`;
            }
            return {
                clientId: errorGroup.clientId,
                summary,
                description,
                priority: this.config.ticket.priorityMap[errorGroup.priority],
                labels: ['error_sync', `error:${errorGroup.clientId}`],
            };
        });
    }
    makeTicketUrl(key) {
        return `https://${this.config.host}/browse/${key}`;
    }
}
//# sourceMappingURL=JiraTicketProvider.js.map