let _agent: unknown = null;

export async function getAgent() {
  if (_agent) return _agent;
  const { T2000 } = await import("@t2000/sdk");
  _agent = await T2000.create();
  return _agent;
}

export function resetAgent() {
  _agent = null;
}

export function setAgent(agent: unknown) {
  _agent = agent;
}