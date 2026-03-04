import "dotenv/config";
import { createServer } from "http";
import { Server, Socket } from "socket.io";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.SOCKET_PORT ?? "3002", 10);
const MAX_MESSAGE_LENGTH = 280;
const RATE_LIMIT_WINDOW_MS = 10_000; // 10 seconds
const RATE_LIMIT_MAX_MESSAGES = 5;

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  /\.vercel\.app$/,
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  sender: string; // wallet address
  message: string;
  timestamp: number;
  room: string;
}

interface TradeNotification {
  signature: string;
  mint: string;
  trader: string;
  type: "buy" | "sell";
  solAmount: number;
  tokenAmount: number;
  timestamp: number;
}

interface TokenCreatedEvent {
  mint: string;
  name: string;
  symbol: string;
  creator: string;
  timestamp: number;
}

interface RateLimitEntry {
  timestamps: number[];
}

// ---------------------------------------------------------------------------
// Rate limiter
// ---------------------------------------------------------------------------

const rateLimitMap = new Map<string, RateLimitEntry>();

function isRateLimited(socketId: string): boolean {
  const now = Date.now();
  let entry = rateLimitMap.get(socketId);

  if (!entry) {
    entry = { timestamps: [] };
    rateLimitMap.set(socketId, entry);
  }

  // Remove timestamps outside the current window
  entry.timestamps = entry.timestamps.filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS,
  );

  if (entry.timestamps.length >= RATE_LIMIT_MAX_MESSAGES) {
    return true;
  }

  entry.timestamps.push(now);
  return false;
}

function cleanupRateLimit(socketId: string): void {
  rateLimitMap.delete(socketId);
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidWalletAddress(address: unknown): address is string {
  // Solana base58 addresses are 32-44 characters
  return (
    typeof address === "string" &&
    address.length >= 32 &&
    address.length <= 44 &&
    /^[1-9A-HJ-NP-Za-km-z]+$/.test(address)
  );
}

// ---------------------------------------------------------------------------
// HTTP server & Socket.io
// ---------------------------------------------------------------------------

const httpServer = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "ok", service: "magicpump-server" }));
});

const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
  },
  pingTimeout: 60_000,
  pingInterval: 25_000,
});

// ---------------------------------------------------------------------------
// Connection handler
// ---------------------------------------------------------------------------

io.on("connection", (socket: Socket) => {
  console.log(`[connect] ${socket.id} from ${socket.handshake.address}`);

  // -----------------------------------------------------------------------
  // Room management
  // -----------------------------------------------------------------------

  socket.on("join_room", (mint: unknown, callback?: (ack: unknown) => void) => {
    try {
      if (!isNonEmptyString(mint)) {
        const err = { error: "Invalid mint address" };
        if (typeof callback === "function") callback(err);
        return;
      }

      socket.join(mint);
      console.log(`[join_room] ${socket.id} -> ${mint}`);

      if (typeof callback === "function") {
        callback({ success: true, room: mint });
      }
    } catch (err) {
      console.error(`[join_room] Error:`, err);
    }
  });

  socket.on("leave_room", (mint: unknown, callback?: (ack: unknown) => void) => {
    try {
      if (!isNonEmptyString(mint)) {
        const err = { error: "Invalid mint address" };
        if (typeof callback === "function") callback(err);
        return;
      }

      socket.leave(mint);
      console.log(`[leave_room] ${socket.id} -> ${mint}`);

      if (typeof callback === "function") {
        callback({ success: true, room: mint });
      }
    } catch (err) {
      console.error(`[leave_room] Error:`, err);
    }
  });

  // -----------------------------------------------------------------------
  // Chat messages
  // -----------------------------------------------------------------------

  socket.on(
    "send_message",
    (
      data: unknown,
      callback?: (ack: unknown) => void,
    ) => {
      try {
        // -- Validate payload structure --------------------------------
        if (typeof data !== "object" || data === null) {
          const err = { error: "Invalid message payload" };
          if (typeof callback === "function") callback(err);
          return;
        }

        const { sender, message, room } = data as Record<string, unknown>;

        if (!isValidWalletAddress(sender)) {
          const err = { error: "Invalid sender wallet address" };
          if (typeof callback === "function") callback(err);
          return;
        }

        if (!isNonEmptyString(message)) {
          const err = { error: "Message cannot be empty" };
          if (typeof callback === "function") callback(err);
          return;
        }

        const trimmedMessage = (message as string).trim();

        if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
          const err = {
            error: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`,
          };
          if (typeof callback === "function") callback(err);
          return;
        }

        if (!isNonEmptyString(room)) {
          const err = { error: "Room (mint address) is required" };
          if (typeof callback === "function") callback(err);
          return;
        }

        // -- Rate limit ------------------------------------------------
        if (isRateLimited(socket.id)) {
          const err = { error: "Rate limited — max 5 messages per 10 seconds" };
          if (typeof callback === "function") callback(err);
          return;
        }

        // -- Broadcast -------------------------------------------------
        const chatMessage: ChatMessage = {
          sender: sender as string,
          message: trimmedMessage,
          timestamp: Date.now(),
          room: room as string,
        };

        io.to(room as string).emit("new_message", chatMessage);

        if (typeof callback === "function") {
          callback({ success: true });
        }
      } catch (err) {
        console.error(`[send_message] Error:`, err);
        if (typeof callback === "function") {
          callback({ error: "Internal server error" });
        }
      }
    },
  );

  // -----------------------------------------------------------------------
  // Trade notifications (emitted by backend / indexer)
  // -----------------------------------------------------------------------

  socket.on("new_trade", (data: unknown) => {
    try {
      if (typeof data !== "object" || data === null) {
        return;
      }

      const { mint } = data as Record<string, unknown>;

      if (!isNonEmptyString(mint)) {
        return;
      }

      const trade: TradeNotification = {
        signature: String((data as Record<string, unknown>).signature ?? ""),
        mint: mint as string,
        trader: String((data as Record<string, unknown>).trader ?? ""),
        type:
          (data as Record<string, unknown>).type === "sell" ? "sell" : "buy",
        solAmount: Number((data as Record<string, unknown>).solAmount) || 0,
        tokenAmount:
          Number((data as Record<string, unknown>).tokenAmount) || 0,
        timestamp:
          Number((data as Record<string, unknown>).timestamp) || Date.now(),
      };

      io.to(mint as string).emit("trade_update", trade);
    } catch (err) {
      console.error(`[new_trade] Error:`, err);
    }
  });

  // -----------------------------------------------------------------------
  // Global: new token created (home feed)
  // -----------------------------------------------------------------------

  socket.on("token_created", (data: unknown) => {
    try {
      if (typeof data !== "object" || data === null) {
        return;
      }

      const payload = data as Record<string, unknown>;

      const event: TokenCreatedEvent = {
        mint: String(payload.mint ?? ""),
        name: String(payload.name ?? ""),
        symbol: String(payload.symbol ?? ""),
        creator: String(payload.creator ?? ""),
        timestamp: Number(payload.timestamp) || Date.now(),
      };

      // Broadcast to ALL connected clients (global event)
      io.emit("token_created", event);
    } catch (err) {
      console.error(`[token_created] Error:`, err);
    }
  });

  // -----------------------------------------------------------------------
  // Disconnect
  // -----------------------------------------------------------------------

  socket.on("disconnect", (reason: string) => {
    cleanupRateLimit(socket.id);
    console.log(`[disconnect] ${socket.id} — ${reason}`);
  });

  // -----------------------------------------------------------------------
  // Generic error handler
  // -----------------------------------------------------------------------

  socket.on("error", (err: Error) => {
    console.error(`[socket error] ${socket.id}:`, err.message);
  });
});

// ---------------------------------------------------------------------------
// Periodic cleanup for stale rate-limit entries (every 60s)
// ---------------------------------------------------------------------------

setInterval(() => {
  const now = Date.now();
  for (const [socketId, entry] of rateLimitMap.entries()) {
    entry.timestamps = entry.timestamps.filter(
      (t) => now - t < RATE_LIMIT_WINDOW_MS,
    );
    if (entry.timestamps.length === 0) {
      rateLimitMap.delete(socketId);
    }
  }
}, 60_000);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

httpServer.listen(PORT, () => {
  console.log(`MagicPump server listening on port ${PORT}`);
});

// Graceful shutdown
function shutdown() {
  console.log("\nShutting down gracefully...");
  io.close(() => {
    httpServer.close(() => {
      console.log("Server closed.");
      process.exit(0);
    });
  });

  // Force exit after 5 seconds
  setTimeout(() => {
    console.error("Forced shutdown after timeout.");
    process.exit(1);
  }, 5_000);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
