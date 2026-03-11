import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchIssues } from '../../js/utils/jira-adapter.js';

function makeFetchMock(issues) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ issues }),
  });
}

function makeIssue(overrides = {}) {
  return {
    key: 'OR-100',
    fields: {
      summary: 'Test Epic',
      description: null,
      priority: { name: 'High' },
      assignee: { displayName: 'Alice Smith' },
      components: [{ name: 'Frontend' }, { name: 'Backend' }],
      ...overrides.fields,
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubGlobal('fetch', makeFetchMock([makeIssue()]));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchIssues', () => {
  it('returns mapped issue with key, title, owner, components', async () => {
    const results = await fetchIssues({
      domain: 'test.atlassian.net',
      email: 'test@test.com',
      token: 'tok',
      jql: 'project = X',
    });
    expect(results).toHaveLength(1);
    expect(results[0].key).toBe('OR-100');
    expect(results[0].title).toBe('Test Epic');
    expect(results[0].owner).toBe('Alice Smith');
    expect(results[0].components).toBe('Frontend, Backend');
  });

  it('maps priority: High', async () => {
    const results = await fetchIssues({ domain: 'd', email: 'e', token: 't', jql: 'x' });
    expect(results[0].priority).toBe('High');
  });

  it('maps priority: Medium', async () => {
    vi.stubGlobal('fetch', makeFetchMock([makeIssue({ fields: { summary: '', description: null, priority: { name: 'Medium' }, assignee: null, components: [] } })]));
    const results = await fetchIssues({ domain: 'd', email: 'e', token: 't', jql: 'x' });
    expect(results[0].priority).toBe('Medium');
  });

  it('maps priority: Lowest → empty', async () => {
    vi.stubGlobal('fetch', makeFetchMock([makeIssue({ fields: { summary: '', description: null, priority: { name: 'Lowest' }, assignee: null, components: [] } })]));
    const results = await fetchIssues({ domain: 'd', email: 'e', token: 't', jql: 'x' });
    expect(results[0].priority).toBe('Low');
  });

  it('handles no assignee', async () => {
    vi.stubGlobal('fetch', makeFetchMock([makeIssue({ fields: { summary: 'X', description: null, priority: null, assignee: null, components: [] } })]));
    const results = await fetchIssues({ domain: 'd', email: 'e', token: 't', jql: 'x' });
    expect(results[0].owner).toBe('');
  });

  it('handles empty components', async () => {
    vi.stubGlobal('fetch', makeFetchMock([makeIssue({ fields: { summary: 'X', description: null, priority: null, assignee: null, components: [] } })]));
    const results = await fetchIssues({ domain: 'd', email: 'e', token: 't', jql: 'x' });
    expect(results[0].components).toBe('');
  });

  it('extracts plain text from ADF description', async () => {
    const adf = {
      content: [
        { content: [{ text: 'Hello ' }, { text: 'World' }] },
        { content: [{ text: 'Second paragraph' }] },
      ],
    };
    vi.stubGlobal('fetch', makeFetchMock([makeIssue({ fields: { summary: 'X', description: adf, priority: null, assignee: null, components: [] } })]));
    const results = await fetchIssues({ domain: 'd', email: 'e', token: 't', jql: 'x' });
    expect(results[0].description).toBe('Hello World Second paragraph');
  });

  it('handles plain string description (non-ADF)', async () => {
    vi.stubGlobal('fetch', makeFetchMock([makeIssue({ fields: { summary: 'X', description: 'plain text', priority: null, assignee: null, components: [] } })]));
    const results = await fetchIssues({ domain: 'd', email: 'e', token: 't', jql: 'x' });
    expect(results[0].description).toBe('plain text');
  });

  it('sends Basic Auth header', async () => {
    const fetchMock = makeFetchMock([]);
    vi.stubGlobal('fetch', fetchMock);
    await fetchIssues({ domain: 'x.atlassian.net', email: 'user@x.com', token: 'mytoken', jql: 'x' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.auth).toBe('Basic ' + btoa('user@x.com:mytoken'));
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ errorMessages: ['Unauthorized'] }),
    }));
    await expect(fetchIssues({ domain: 'd', email: 'e', token: 't', jql: 'x' }))
      .rejects.toThrow('Unauthorized');
  });

  it('returns empty array when issues is empty', async () => {
    vi.stubGlobal('fetch', makeFetchMock([]));
    const results = await fetchIssues({ domain: 'd', email: 'e', token: 't', jql: 'x' });
    expect(results).toEqual([]);
  });
});
