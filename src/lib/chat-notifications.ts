import { Client } from "pg";

type Subscriber = { game: number; change: () => void; disconnect: () => void };
class ChatNotifications {
  private client?: Client;
  private connecting?: Promise<void>;
  private subscribers = new Set<Subscriber>();

  private connect() {
    if (!this.connecting) {
      const client = new Client({ connectionString: process.env.DATABASE_URL, application_name: "community-chat-listener", connectionTimeoutMillis: 5000 });
      this.client = client;
      const lost = () => {
        if (this.client !== client) return;
        this.client = undefined;
        this.connecting = undefined;
        for (const subscriber of [...this.subscribers]) subscriber.disconnect();
        this.subscribers.clear();
        void client.end().catch(() => {});
      };
      client.on("error", lost);
      client.on("end", lost);
      client.on("notification", event => {
        if (event.channel !== "community_chat_changed") return;
        for (const subscriber of this.subscribers) {
          if (String(subscriber.game) === event.payload) subscriber.change();
        }
      });
      this.connecting = client.connect().then(async () => { await client.query("LISTEN community_chat_changed"); }).catch(error => { lost(); throw error; });
    }
    return this.connecting;
  }

  async subscribe(subscriber: Subscriber) {
    await this.connect();
    this.subscribers.add(subscriber);
    return () => { this.subscribers.delete(subscriber); };
  }
}

const globalChat = globalThis as typeof globalThis & { chatNotifications?: ChatNotifications };
export const chatNotifications = globalChat.chatNotifications ??= new ChatNotifications();
