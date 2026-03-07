import {
  ClipCapturedPayload as ContractsClipCapturedPayload,
  ClipPinnedPayload as ContractsClipPinnedPayload,
  ClipUnpinnedPayload as ContractsClipUnpinnedPayload,
  ClipDeletedPayload as ContractsClipDeletedPayload,
  ClipTaggedPayload as ContractsClipTaggedPayload,
  ClipUntaggedPayload as ContractsClipUntaggedPayload,
  ClipMergedPayload as ContractsClipMergedPayload,
  ClipPastedPayload as ContractsClipPastedPayload,
  SnippetCreatedPayload as ContractsSnippetCreatedPayload,
  SnippetUpdatedPayload as ContractsSnippetUpdatedPayload,
  SnippetDeletedPayload as ContractsSnippetDeletedPayload,
  SettingsUpdatedPayload as ContractsSettingsUpdatedPayload,
} from "@clipm/contracts";

// Server-internal alias surface, backed by contract schemas as the source of truth.
export const ClipCapturedPayload = ContractsClipCapturedPayload;
export const ClipPinnedPayload = ContractsClipPinnedPayload;
export const ClipUnpinnedPayload = ContractsClipUnpinnedPayload;
export const ClipDeletedPayload = ContractsClipDeletedPayload;
export const ClipTaggedPayload = ContractsClipTaggedPayload;
export const ClipUntaggedPayload = ContractsClipUntaggedPayload;
export const ClipMergedPayload = ContractsClipMergedPayload;
export const ClipPastedPayload = ContractsClipPastedPayload;
export const SnippetCreatedPayload = ContractsSnippetCreatedPayload;
export const SnippetUpdatedPayload = ContractsSnippetUpdatedPayload;
export const SnippetDeletedPayload = ContractsSnippetDeletedPayload;
export const SettingsUpdatedPayload = ContractsSettingsUpdatedPayload;
