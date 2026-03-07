import { Layer } from "effect";

import { ClipboardEventStoreLive } from "./persistence/Layers/ClipboardEventStore.ts";
import { ClipboardCommandReceiptRepositoryLive } from "./persistence/Layers/CommandReceiptRepository.ts";
import { ProjectionClipRepositoryLive } from "./persistence/Layers/ProjectionClips.ts";
import { ProjectionSnippetRepositoryLive } from "./persistence/Layers/ProjectionSnippets.ts";
import { ProjectionStateRepositoryLive } from "./persistence/Layers/ProjectionState.ts";
import { ProjectionStatsRepositoryLive } from "./persistence/Layers/ProjectionStats.ts";

import { ClipboardEngineLive } from "./clipboard/Layers/ClipboardEngine.ts";
import { ClipboardProjectionPipelineLive } from "./clipboard/Layers/ProjectionPipeline.ts";
import { SearchServiceLive } from "./clipboard/Layers/SearchService.ts";

/**
 * Compose all persistence repository layers.
 */
const PersistenceLayer = Layer.mergeAll(
  ClipboardEventStoreLive,
  ClipboardCommandReceiptRepositoryLive,
  ProjectionClipRepositoryLive,
  ProjectionSnippetRepositoryLive,
  ProjectionStateRepositoryLive,
  ProjectionStatsRepositoryLive,
);

/**
 * Compose all clipboard domain service layers.
 */
export function makeServerRuntimeServicesLayer() {
  const pipelineLayer = ClipboardProjectionPipelineLive.pipe(Layer.provide(PersistenceLayer));

  const engineLayer = ClipboardEngineLive.pipe(
    Layer.provide(pipelineLayer),
    Layer.provide(PersistenceLayer),
  );

  const searchLayer = SearchServiceLive.pipe(Layer.provide(PersistenceLayer));

  return Layer.mergeAll(engineLayer, searchLayer).pipe(Layer.provideMerge(PersistenceLayer));
}
