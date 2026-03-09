// jira-adapter.js — import issues from Jira Cloud via Basic Auth (email + API token)

const PROXY = '/api/jira-proxy';

/**
 * Fetch Jira issues matching a JQL query.
 * @param {string} domain     e.g. "onebeat.atlassian.net"
 * @param {string} email      Atlassian account email
 * @param {string} token      Atlassian API token
 * @param {string} jql        JQL query string
 * @param {number} maxResults
 * @returns {Promise<Array<{key,title,description,priority,owner}>>}
 */
export async function fetchIssues({ domain, email, token, jql, maxResults = 100 }) {
  const auth = btoa(`${email}:${token}`);
  const url = `https://${domain}/rest/api/3/search/jql`;

  const resp = await fetch(PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      auth: `Basic ${auth}`,
      body: JSON.stringify({ jql, maxResults, fields: ['summary', 'description', 'priority', 'assignee', 'components'] })
    })
  });

  const data = await resp.json();

  if (!resp.ok) {
    const msg = (data.errorMessages || []).join(' ') || data.message || `Jira error ${resp.status}`;
    throw new Error(msg);
  }

  return (data.issues || []).map(issue => ({
    key: issue.key,
    title: issue.fields.summary || '',
    description: _adfToText(issue.fields.description),
    priority: _mapPriority(issue.fields.priority?.name),
    owner: issue.fields.assignee?.displayName || '',
    components: (issue.fields.components || []).map(c => c.name).join(', ')
  }));
}

// Extract plain text from Atlassian Document Format (ADF)
function _adfToText(doc) {
  if (!doc) return '';
  if (typeof doc === 'string') return doc;
  return (doc.content || [])
    .map(block => (block.content || []).map(n => n.text || '').join(''))
    .join(' ')
    .trim();
}

function _mapPriority(name) {
  if (!name) return '';
  const p = name.toLowerCase();
  if (p === 'highest' || p === 'high') return 'High';
  if (p === 'medium') return 'Medium';
  if (p === 'low' || p === 'lowest') return 'Low';
  return '';
}
