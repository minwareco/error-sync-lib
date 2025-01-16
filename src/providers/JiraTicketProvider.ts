import { TicketProviderInterface } from '../interfaces';
import { ErrorGroup, ErrorPriority, Ticket, TicketContent } from '../models';
import JiraApi from 'jira-client';
import { getReadableErrorCountPeriod, getReadableErrorFrequency } from "../util/ErrorUtil";

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
  private jiraClient;

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

    const jiraClientConfig: any = {
      protocol: 'https',
      host: this.config.host,
      apiVersion: '2',
      strictSSL: true,
    };

    if (this.config.basicAuth) {
      jiraClientConfig.username = this.config.basicAuth.username;
      jiraClientConfig.password = this.config.basicAuth.apiKey;
    } else if (this.config.oauth) {
      jiraClientConfig.oauth = {
        consumer_key: this.config.oauth.consumerKey,
        consumer_secret: this.config.oauth.consumerSecret,
        access_token: this.config.oauth.accessToken,
        access_token_secret: this.config.oauth.accessTokenSecret,
      }
    } else {
      throw new Error('JiraTicketProvider configuration must specify either the \'basicAuth\' or \'oauth\' property');
    }

    this.jiraClient = new JiraApi(jiraClientConfig);
  }

  public async findTicket(clientId: string): Promise<Ticket|undefined> {
    const jql = `labels = "error:${clientId}"`;
    const jiraResults = await this.jiraClient.searchJira(jql);

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
  }

  public async createTicket(ticketContent: TicketContent): Promise<Ticket> {
    const jiraTicketRequest: any = {
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

    // optionally specify components
    if (this.config.ticket.componentIds) {
      const components = [];
      for (const componentId of this.config.ticket.componentIds) {
        components.push({ id: componentId });
      }

      jiraTicketRequest.fields.components = components;
    }

    const jiraTicket = await this.jiraClient.addNewIssue(jiraTicketRequest);
    return Object.assign(ticketContent, {
      id: jiraTicket.id,
      url: this.makeTicketUrl(jiraTicket.key),
      isOpen: true,
      resolutionDate: undefined,
    });
  }

  public async updateTicket(ticket: Ticket): Promise<Ticket> {
    await this.jiraClient.updateIssue(ticket.id, {
      fields: {
        summary: ticket.summary,
        description: ticket.description,
        priority: {
          name: ticket.priority
        },
      },
    }, {
      // do not send email update for this change
      notifyUsers: false,
    });

    // query for the full ticket detail so it can be returned
    return this.findTicket(ticket.clientId);
  }

  public async reopenTicket(ticket: Ticket): Promise<Ticket> {
    await this.jiraClient.transitionIssue(ticket.id, {
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

