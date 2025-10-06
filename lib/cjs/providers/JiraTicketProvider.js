"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JiraTicketProvider = void 0;
const models_1 = require("../models");
const jsurl_1 = __importDefault(require("jsurl"));
const jira_js_1 = require("jira.js");
const url_1 = require("url");
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
        if (this.config.basicAuth) {
            this.jiraClient = new jira_js_1.Version3Client({
                host: `https://${this.config.host}`,
                authentication: {
                    basic: {
                        email: this.config.basicAuth.username,
                        apiToken: this.config.basicAuth.apiKey,
                    },
                },
            });
        }
        else if (this.config.oauth) {
            throw new Error('OAuth authentication is not currently supported with jira.js. Please use basic authentication with email and API token.');
        }
        else {
            throw new Error('JiraTicketProvider configuration must specify either the \'basicAuth\' or \'oauth\' property');
        }
    }
    async findTicket(clientId) {
        var _a, _b;
        const jql = `labels = "error:${clientId}"`;
        const searchParams = {
            jql,
            maxResults: 1,
            fields: ['summary', 'priority', 'description', 'labels', 'resolution', 'resolutiondate', 'issuetype'],
        };
        const jiraResults = await this.jiraClient.issueSearch.searchForIssuesUsingJqlEnhancedSearch(searchParams);
        if (!jiraResults.issues || jiraResults.issues.length === 0) {
            return undefined;
        }
        const jiraTicket = jiraResults.issues[0];
        return {
            id: jiraTicket.id,
            clientId,
            url: this.makeTicketUrl(jiraTicket.key),
            summary: jiraTicket.fields.summary,
            priority: (_a = jiraTicket.fields.priority) === null || _a === void 0 ? void 0 : _a.name,
            description: jiraTicket.fields.description,
            labels: jiraTicket.fields.labels,
            isOpen: jiraTicket.fields.resolution === null,
            resolutionDate: jiraTicket.fields.resolutiondate,
            ticketType: (_b = jiraTicket.fields.issuetype) === null || _b === void 0 ? void 0 : _b.id,
        };
    }
    async createTicket(ticketContent) {
        const issueData = {
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
        };
        if (this.config.ticket.componentIds) {
            const components = [];
            for (const componentId of this.config.ticket.componentIds) {
                components.push({ id: componentId });
            }
            issueData.fields.components = components;
        }
        const jiraTicket = await this.jiraClient.issues.createIssue(issueData);
        return Object.assign(ticketContent, {
            id: jiraTicket.id,
            url: this.makeTicketUrl(jiraTicket.key),
            isOpen: true,
            resolutionDate: undefined,
        });
    }
    async updateTicket(ticket) {
        await this.jiraClient.issues.editIssue({
            issueIdOrKey: ticket.id,
            notifyUsers: false,
            fields: {
                summary: ticket.summary,
                description: ticket.description,
                priority: {
                    name: ticket.priority
                },
            },
        });
        return this.findTicket(ticket.clientId);
    }
    async reopenTicket(ticket) {
        await this.jiraClient.issues.doTransition({
            issueIdOrKey: ticket.id,
            transition: {
                id: this.config.ticket.openTransitionId,
            },
        });
        return this.findTicket(ticket.clientId);
    }
    async generateTicketContent(errorGroup) {
        var _a;
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
        if (errorGroup.userEmails.length > 0) {
            description += `\n\n[User Emails](${errorGroup.userEmails.join(', ')})`;
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
    }
    makeTicketUrl(key) {
        return `https://${this.config.host}/browse/${key}`;
    }
}
exports.JiraTicketProvider = JiraTicketProvider;
const makeReportUrl = (message, mixpanelIds) => {
    const baseUrl = 'https://mixpanel.com/project/2559783/view/3099527/app/boards#id=9957583&';
    const searchParams = new url_1.URLSearchParams();
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