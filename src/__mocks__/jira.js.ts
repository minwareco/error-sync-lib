// Mock implementation of jira.js for testing

export const Version3Client = jest.fn().mockImplementation(() => ({
  issueSearch: {
    searchForIssuesUsingJql: jest.fn().mockResolvedValue({
      issues: [
        {
          id: 'mock-id-123',
          key: 'MOCK-123',
          fields: {
            summary: 'Mock issue summary',
            priority: { name: 'High' },
            description: 'Mock description',
            labels: ['error_sync', 'error:mock-client-id'],
            resolution: null,
            resolutiondate: null,
            issuetype: { id: 'mock-issue-type' },
          },
        },
      ],
      total: 1,
    }),
  },
  issues: {
    createIssue: jest.fn().mockResolvedValue({
      id: 'new-mock-id-456',
      key: 'MOCK-456',
    }),
    editIssue: jest.fn().mockResolvedValue({}),
    doTransition: jest.fn().mockResolvedValue({}),
  },
}));