import { offeredTools } from '../tools/registry';
import {
  validateSkillInvocation,
  type SkillContract,
  type SkillValueType,
} from './contract';

function propertyType(type: string): SkillValueType {
  if (type === 'number' || type === 'integer' || type === 'boolean') return type;
  return 'string';
}

// Fail closed: a newly added tool must be explicitly classified before it can execute.
const TOOL_RISKS: Record<string, SkillContract['risk']> = {
  generate_video: 'reversible-write',
  make_film: 'reversible-write',
  web_search: 'read-only',
  calculator: 'read-only',
  get_current_datetime: 'read-only',
  get_device_info: 'read-only',
  search_knowledge_base: 'read-only',
  read_url: 'read-only',
};

/** Convert the existing OGAM tool registry into the shared Jarvis skill contract. */
export function getToolSkillContract(toolName: string): SkillContract | null {
  const tool = offeredTools().find(candidate => candidate.name === toolName);
  if (!tool) return null;

  const risk = TOOL_RISKS[tool.id];
  if (!risk) return null;

  const properties = Object.fromEntries(
    Object.entries(tool.parameters).map(([name, parameter]) => [
      name,
      {
        type: propertyType(parameter.type),
        description: parameter.description,
        ...(parameter.enum ? { enum: parameter.enum } : {}),
      },
    ]),
  );

  return {
    id: `tool.${tool.id}`,
    version: 1,
    title: tool.displayName,
    description: tool.description,
    input: {
      type: 'object',
      properties,
      required: Object.entries(tool.parameters)
        .filter(([, parameter]) => parameter.required)
        .map(([name]) => name),
      additionalProperties: false,
    },
    requiredCapabilities: [`tool:${tool.id}`],
    ...(tool.requiresNetwork ? { requiresNetwork: true } : {}),
    risk,
    confirmation: 'never',
    executionMode: 'foreground',
    timeoutMs: 30_000,
    supportsCancellation: false,
    supportsUndo: false,
  };
}

/**
 * A tool being offered to the model is not permission by itself. The caller must
 * pass the tool IDs enabled by the person in this chat. Network capability is
 * granted only for an enabled tool whose registry entry declares network use.
 */
export function validateBuiltInToolInvocation(
  toolName: string,
  input: unknown,
  enabledToolIds: readonly string[],
) {
  const skill = getToolSkillContract(toolName);
  if (!skill) {
    return {
      valid: false,
      errors: [`Tool is not available in this build: ${toolName}.`],
      requiresApproval: false,
    };
  }

  const enabled = offeredTools().find(tool => tool.name === toolName);
  const grantedCapabilities = enabledToolIds.map(id => `tool:${id}`);
  if (enabled && enabledToolIds.includes(enabled.id) && enabled.requiresNetwork) {
    grantedCapabilities.push('network');
  }

  return validateSkillInvocation(skill, input, grantedCapabilities);
}

/**
 * Discover only the built-in skills that are both available in this build and
 * explicitly enabled for the current conversation. This is the catalogue the
 * Jarvis planner/HUD may present; discovery never grants execution permission.
 */
export function getAvailableToolSkillContracts(
  enabledToolIds: readonly string[],
): SkillContract[] {
  const enabled = new Set(enabledToolIds);
  return offeredTools()
    .filter(tool => enabled.has(tool.id))
    .map(tool => getToolSkillContract(tool.name))
    .filter((skill): skill is SkillContract => skill !== null);
}
