import { describe, expect, it } from "vitest";
import type { ClipboardCommand } from "@clipm/contracts";

import { PendingCommandQueue } from "./commandQueue.ts";

function pinCommand(id: string): ClipboardCommand {
  return {
    commandId: id,
    type: "clip.pin",
    clipId: `clip-${id}`,
  } as unknown as ClipboardCommand;
}

describe("PendingCommandQueue", () => {
  it("flushes in FIFO order", () => {
    const queue = new PendingCommandQueue();
    queue.enqueue(pinCommand("a"));
    queue.enqueue(pinCommand("b"));
    queue.enqueue(pinCommand("c"));

    const sent: string[] = [];
    queue.flush((command) => {
      sent.push(command.commandId);
      return true;
    });

    expect(sent).toEqual(["a", "b", "c"]);
    expect(queue.size).toBe(0);
  });

  it("drops the oldest command at capacity", () => {
    const queue = new PendingCommandQueue(3);
    for (const id of ["a", "b", "c", "d"]) {
      queue.enqueue(pinCommand(id));
    }

    const sent: string[] = [];
    queue.flush((command) => {
      sent.push(command.commandId);
      return true;
    });

    expect(sent).toEqual(["b", "c", "d"]);
  });

  it("stops flushing when send fails and retains the remainder", () => {
    const queue = new PendingCommandQueue();
    queue.enqueue(pinCommand("a"));
    queue.enqueue(pinCommand("b"));
    queue.enqueue(pinCommand("c"));

    const sent: string[] = [];
    queue.flush((command) => {
      if (command.commandId === "b") return false;
      sent.push(command.commandId);
      return true;
    });

    expect(sent).toEqual(["a"]);
    expect(queue.size).toBe(2);

    // A later flush drains what was retained.
    queue.flush((command) => {
      sent.push(command.commandId);
      return true;
    });
    expect(sent).toEqual(["a", "b", "c"]);
    expect(queue.size).toBe(0);
  });
});
