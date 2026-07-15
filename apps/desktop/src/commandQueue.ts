import type { ClipboardCommand } from "@clipm/contracts";

/**
 * Buffers clipboard commands while the in-process server connection is
 * down, so captures made during a reconnect are not lost. Re-sending is
 * safe: the server deduplicates by commandId receipt.
 */
export class PendingCommandQueue {
  private readonly items: ClipboardCommand[] = [];

  constructor(private readonly capacity: number = 100) {}

  get size(): number {
    return this.items.length;
  }

  /** Drop-oldest when full: the newest capture matters most. */
  enqueue(command: ClipboardCommand): void {
    if (this.items.length >= this.capacity) this.items.shift();
    this.items.push(command);
  }

  /**
   * FIFO flush. `send` returns false to abort (socket dropped mid-flush);
   * the unsent remainder is retained for the next flush.
   */
  flush(send: (command: ClipboardCommand) => boolean): void {
    while (this.items.length > 0) {
      if (!send(this.items[0]!)) return;
      this.items.shift();
    }
  }
}
