import { ErrorPriority } from '../models';
import JSURL from 'jsurl';
import { Version3Client } from 'jira.js';
import { URLSearchParams } from 'url';
import { WikiMarkupTransformer } from '@atlaskit/editor-wikimarkup-transformer';
import { JSONTransformer } from '@atlaskit/editor-json-transformer';
export class JiraTicketProvider {
    constructor(config) {
        this.config = JSON.parse(JSON.stringify(config));
        if (!this.config.ticket.priorityMap) {
            this.config.ticket.priorityMap = {
                [ErrorPriority.P1]: 'Highest',
                [ErrorPriority.P2]: 'High',
                [ErrorPriority.P3]: 'Medium',
                [ErrorPriority.P4]: 'Low',
                [ErrorPriority.P5]: 'Lowest',
            };
        }
        if (this.config.basicAuth) {
            this.jiraClient = new Version3Client({
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
        var _a, _b, _c;
        const jql = `labels = "error:${clientId}"`;
        console.log(`[JiraTicketProvider.findTicket] Searching for ticket with JQL: ${jql}`);
        const searchParams = {
            jql,
            maxResults: 1,
            fields: ['summary', 'priority', 'description', 'labels', 'resolution', 'resolutiondate', 'issuetype'],
        };
        const jiraResults = await this.jiraClient.issueSearch.searchForIssuesUsingJqlEnhancedSearch(searchParams);
        console.log(`[JiraTicketProvider.findTicket] Found ${((_a = jiraResults.issues) === null || _a === void 0 ? void 0 : _a.length) || 0} tickets for clientId: ${clientId}`);
        if (!jiraResults.issues || jiraResults.issues.length === 0) {
            console.log(`[JiraTicketProvider.findTicket] No ticket found for clientId: ${clientId}`);
            return undefined;
        }
        const jiraTicket = jiraResults.issues[0];
        const ticket = {
            id: jiraTicket.id,
            clientId,
            url: this.makeTicketUrl(jiraTicket.key),
            summary: jiraTicket.fields.summary,
            priority: (_b = jiraTicket.fields.priority) === null || _b === void 0 ? void 0 : _b.name,
            description: jiraTicket.fields.description,
            labels: jiraTicket.fields.labels,
            isOpen: jiraTicket.fields.resolution === null,
            resolutionDate: jiraTicket.fields.resolutiondate,
            ticketType: (_c = jiraTicket.fields.issuetype) === null || _c === void 0 ? void 0 : _c.id,
        };
        console.log(`[JiraTicketProvider.findTicket] Found ticket for clientId: ${clientId}`);
        console.log(`  - ID: ${jiraTicket.id}, Key: ${jiraTicket.key}`);
        console.log(`  - isOpen: ${ticket.isOpen} (resolution: ${jiraTicket.fields.resolution})`);
        console.log(`  - resolutionDate: ${ticket.resolutionDate}`);
        console.log(`  - labels: ${ticket.labels.join(', ')}`);
        return ticket;
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
        let wikiDescription = `{noformat}${errorGroup.name}{noformat}` +
            '\nh4. Priority Reason\n' +
            `${errorGroup.priorityReason}` +
            '\nh4. Instances\n';
        for (const instance of errorGroup.instances.slice(0, maxInstances)) {
            let hasDetail = false;
            wikiDescription += `{noformat}${instance.name}{noformat}`;
            if (instance.debugUrl) {
                wikiDescription += `\n\nTroubleshoot at: [${instance.debugUrl}]`;
                hasDetail = true;
            }
            if (instance.debugMessage) {
                wikiDescription += `\n\n${instance.debugMessage}`;
                hasDetail = true;
            }
            if (!hasDetail) {
                wikiDescription += `\n\n_no debug info available_`;
            }
            wikiDescription += '\n\n';
        }
        if (errorGroup.instances.length > 10) {
            const additional = (errorGroup.instances.length - maxInstances);
            wikiDescription += `\n_...${additional} older instances not shown_\n`;
        }
        if (errorGroup.mixpanelIds.length > 0) {
            const mixpanelUrl = makeReportUrl(errorGroup.instances[0].name.substring(0, 100).trim(), errorGroup.mixpanelIds);
            wikiDescription += `\n[Mixpanel Events|${mixpanelUrl}]`;
        }
        if (errorGroup.userEmails.length > 0) {
            wikiDescription += `\n\nUser Emails: ${errorGroup.userEmails.join(', ')}`;
        }
        const wikiTransformer = new WikiMarkupTransformer();
        const jsonTransformer = new JSONTransformer();
        const doc = wikiTransformer.parse(wikiDescription);
        const description = jsonTransformer.encode(doc);
        return {
            clientId: errorGroup.clientId,
            summary,
            description,
            priority: this.config.ticket.priorityMap[ErrorPriority.P4],
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
    static sameTicketContent(existingTicketContent, freshTicketContent) {
        const adfTransformer = new JSONTransformer();
        const wikiTransformer = new WikiMarkupTransformer();
        const existingDescription = typeof existingTicketContent.description === 'string' ? existingTicketContent.description : wikiTransformer.encode(adfTransformer.parse(existingTicketContent.description));
        const freshDescription = typeof freshTicketContent.description === 'string' ? freshTicketContent.description : wikiTransformer.encode(adfTransformer.parse(freshTicketContent.description));
        return existingTicketContent.summary === freshTicketContent.summary &&
            existingDescription === freshDescription;
    }
}
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
    const settings = JSURL.stringify(filterSettings);
    searchParams.set('filters', settings);
    return `${baseUrl}${searchParams.toString()}`;
};
//# sourceMappingURL=JiraTicketProvider.js.map