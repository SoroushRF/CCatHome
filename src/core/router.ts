import { z } from "zod";
import { PermissionTier } from "./constants.js";

export interface CapabilityDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodObject<any>;
  tier: PermissionTier;
}

export type CapabilityHandler = (args: any) => Promise<any>;

export interface RegisteredCapability {
  definition: CapabilityDefinition;
  handler: CapabilityHandler;
}

const capabilityRegistry = new Map<string, RegisteredCapability>();

export function registerCapability(
  definition: CapabilityDefinition,
  handler: CapabilityHandler,
): void {
  capabilityRegistry.set(definition.name, { definition, handler });
}

export function getCapability(name: string): RegisteredCapability | undefined {
  return capabilityRegistry.get(name);
}

export function getAllCapabilities(): RegisteredCapability[] {
  return Array.from(capabilityRegistry.values());
}

export function clearRegistry(): void {
  capabilityRegistry.clear();
}
