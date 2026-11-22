import type { ToolDefinition } from '../tools/types';
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

/** Convert the existing OGAM tool registry into the shared Jarvis skill contract. */
export function getToolSkillContract(toolName: string): SkillContract | null {
  const tool = offeredTools().find(candidate => candidate.name === toolName);
  if (!tool) return null;

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

  const isGeneration = tool.id === 'generate_video' || tool.id === 'make_film';
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
    risk: isGeneration ? 'reversible-write' : 'read-only',
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
