"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JiraTicketProvider = void 0;
const models_1 = require("../models");
const jsurl_1 = __importDefault(require("jsurl"));
const jira_client_1 = __importDefault(require("jira-client"));
class JiraTicketProvider {
    constructor(config) {
        this.config = JSON.parse(JSON.stringify(config));
        if (!this.config.ticket.priorityMap) {
            this.config.ticket.priorityMap = {
                [models_1.ErrorPriority.P1]: 'Highest',
                [models_1.ErrorPriority.P2]: 'High',
                [models_1.ErrorPriority.P3]: 'Medium',
                [models_1.ErrorPriority.P4]: 'Low',
                [models_1.ErrorPriority.P5]: 'Lowest',
            };
        }
        const jiraClientConfig = {
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
        this.jiraClient = new jira_client_1.default(jiraClientConfig);
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
                resolutionDate: jiraTicket.fields.resolutiondate,
                ticketType: jiraTicket.fields.issuetype.id,
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
                        id: ticketContent.ticketType || this.config.ticket.issueTypeId,
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
            if (this.config.ticket.componentIds) {
                const components = [];
                for (const componentId of this.config.ticket.componentIds) {
                    components.push({ id: componentId });
                }
                jiraTicketRequest.fields.components = components;
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
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const maxInstances = 10;
            const groupNameSanitized = errorGroup.name
                .replace(/\r\n/g, ' ')
                .replace(/\n/g, ' ')
                .replace(/\\n/g, ' ');
            const summary = `[${errorGroup.type}] [${errorGroup.sourceName}] ${groupNameSanitized}`;
            let description = `{noformat}${errorGroup.name}{noformat}` +
                '\nh4.Priority Reason\n' +
                `${errorGroup.priorityReason}` +
                '\nh4.Instances\n';
            for (const instance of errorGroup.instances.slice(0, maxInstances)) {
                let hasDetail = false;
                description += `{noformat}${instance.name}{noformat}`;
                if (instance.debugUrl) {
                    description += `\n\nTroubleshoot at: [${instance.debugUrl}]`;
                    hasDetail = true;
                }
                if (instance.debugMessage) {
                    description += `\n\n${instance.debugMessage}`;
                    hasDetail = true;
                }
                if (!hasDetail) {
                    description += `\n\n_no debug info available_`;
                }
            }
            if (errorGroup.instances.length > 10) {
                const additional = (errorGroup.instances.length - maxInstances);
                description += `\n\n_...${additional} older instances not shown_`;
            }
            if (errorGroup.mixpanelIds.length > 0) {
                description += `\n\n[Mixpanel Events](${makeReportUrl(errorGroup.instances[0].name.substring(0, 100).trim(), errorGroup.mixpanelIds)})`;
            }
            return {
                clientId: errorGroup.clientId,
                summary,
                description,
                priority: this.config.ticket.priorityMap[models_1.ErrorPriority.P4],
                labels: [
                    'error_sync',
                    `error:${errorGroup.clientId}`,
                    errorGroup.sourceName,
                    errorGroup.type,
                ],
                ticketType: ((_a = errorGroup.instances[0]) === null || _a === void 0 ? void 0 : _a.ticketType) || this.config.ticket.issueTypeId,
            };
        });
    }
    makeTicketUrl(key) {
        return `https://${this.config.host}/browse/${key}`;
    }
}
exports.JiraTicketProvider = JiraTicketProvider;
const makeReportUrl = (message, mixpanelIds) => {
    const baseUrl = 'https://mixpanel.com/project/2559783/view/3099527/app/boards#id=9957583&';
    const searchParams = new URLSearchParams();
    const filterSettings = [
        {
            resourceType: 'event',
            propertyName: 'message',
            propertyObjectKey: null,
            propertyDefaultType: 'string',
            propertyType: 'string',
            filterOperator: 'contains',
            filterValue: message,
            limitValues: false,
            defaultEmpty: false,
            activeValue: message
        },
        {
            resourceType: 'event',
            propertyName: '$distinct_id',
            propertyObjectKey: null,
            propertyDefaultType: 'string',
            propertyType: 'string',
            filterOperator: 'equals',
            filterValue: mixpanelIds,
            limitValues: false,
            defaultEmpty: false,
            activeValue: mixpanelIds
        }
    ];
    const settings = jsurl_1.default.stringify(filterSettings);
    searchParams.set('filters', settings);
    return `${baseUrl}${searchParams.toString()}`;
};
//# sourceMappingURL=JiraTicketProvider.js.map