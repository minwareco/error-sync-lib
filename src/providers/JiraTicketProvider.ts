import { TicketProviderInterface } from '../interfaces';
import { ErrorGroup, ErrorPriority, Ticket, TicketContent } from '../models';
import JSURL from 'jsurl';
import { Version3Client } from 'jira.js';
import { URLSearchParams } from 'url';

export type JiraBasicAuthConfig = {
  username: string,
  apiKey: string,
}

export type JiraOAuthConfig = {
  consumerKey: string,
  consumerSecret: string,
  accessToken: string,
  accessTokenSecret: string,
}

export type JiraTicketConfig = {
  projectId: string,
  issueTypeId: string,
  openTransitionId: string,
  componentIds?: string[],
  priorityMap?: Record<string, string>,
}

export type JiraTicketProviderConfig = {
  host: string,
  basicAuth?: JiraBasicAuthConfig,
  oauth?: JiraOAuthConfig,
  ticket: JiraTicketConfig,
}

export class JiraTicketProvider implements TicketProviderInterface {
  private config;
  private jiraClient: Version3Client;

  public constructor(config: JiraTicketProviderConfig) {
    this.config = JSON.parse(JSON.stringify(config));

    // use default priority mappings if they are not provided
    if (!this.config.ticket.priorityMap) {
      this.config.ticket.priorityMap = {
        [ErrorPriority.P1]: 'Highest',
        [ErrorPriority.P2]: 'High',
        [ErrorPriority.P3]: 'Medium',
        [ErrorPriority.P4]: 'Low',
        [ErrorPriority.P5]: 'Lowest',
      };
    }

    // Initialize jira.js client
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
    } else if (this.config.oauth) {
      // OAuth is not directly supported in jira.js v3 - would need OAuth2
      // For now, throwing an error until OAuth2 is implemented
      throw new Error('OAuth authentication is not currently supported with jira.js. Please use basic authentication with email and API token.');
    } else {
      throw new Error('JiraTicketProvider configuration must specify either the \'basicAuth\' or \'oauth\' property');
    }
  }

  public async findTicket(clientId: string): Promise<Ticket|undefined> {
    const jql = `labels = "error:${clientId}"`;

    const searchParams: any = {
      jql,
      maxResults: 1,
      fields: ['summary', 'priority', 'description', 'labels', 'resolution', 'resolutiondate', 'issuetype'],
    };

    const jiraResults = await this.jiraClient.issueSearch.searchForIssuesUsingJql(searchParams);

    if (!jiraResults.issues || jiraResults.issues.length === 0) {
      return undefined;
    }

    const jiraTicket = jiraResults.issues[0];
    return {
      id: jiraTicket.id,
      clientId,
      url: this.makeTicketUrl(jiraTicket.key),
      summary: jiraTicket.fields.summary as string,
      priority: jiraTicket.fields.priority?.name as string,
      description: jiraTicket.fields.description as any,
      labels: jiraTicket.fields.labels,
      isOpen: jiraTicket.fields.resolution === null,
      resolutionDate: jiraTicket.fields.resolutiondate,
      ticketType: jiraTicket.fields.issuetype?.id,
    };
  }

  public async createTicket(ticketContent: TicketContent): Promise<Ticket> {
    const issueData: any = {
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

    // optionally specify components
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

  public async updateTicket(ticket: Ticket): Promise<Ticket> {
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

    // query for the full ticket detail so it can be returned
    return this.findTicket(ticket.clientId);
  }

  public async reopenTicket(ticket: Ticket): Promise<Ticket> {
    await this.jiraClient.issues.doTransition({
      issueIdOrKey: ticket.id,
      transition: {
        id: this.config.ticket.openTransitionId,
      },
    });

    // query for the full ticket detail so it can be returned
    return this.findTicket(ticket.clientId);
  }

  public async generateTicketContent(errorGroup: ErrorGroup): Promise<TicketContent> {
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


    // Add a message with a link the mixpanel events page and then
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
      // Hard code priority to Low per https://minware.atlassian.net/browse/MW-4435
      priority: this.config.ticket.priorityMap[ErrorPriority.P4],
      labels: [
        'error_sync',
        `error:${errorGroup.clientId}`,
        errorGroup.sourceName,
        errorGroup.type,
      ],
      // Use the ticketType from the first error instance if available, otherwise fall back to config
      ticketType: errorGroup.instances[0]?.ticketType || this.config.ticket.issueTypeId,
    }
  }

  private makeTicketUrl(key: string): string {
    return `https://${this.config.host}/browse/${key}`
  }
}


const makeReportUrl = (message: string, mixpanelIds: string[]): string => {
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
  ]

  const settings = JSURL.stringify(filterSettings);  
  searchParams.set('filters', settings);

  return `${baseUrl}${searchParams.toString()}`;
}
