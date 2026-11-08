
import { DEFAULT_CACHE_MAX_SIZE, DEFAULT_CACHE_TTL_MS } from '../constants/limits';

interface CacheNode<K, V> {
  key: K;
  value: V;
  prev: CacheNode<K, V> | null;
  next: CacheNode<K, V> | null;
  expiresAt: number;
}

export interface CacheOptions<K, V> {
  maxSize?: number;
  ttl?: number;
  onEvict?: (key: K, value: V) => void;
}

export class LRUCache<K, V> {
  private readonly maxSize: number;
  private readonly ttl: number;
  private readonly onEvict?: (key: K, value: V) => void;
  private readonly cache: Map<K, CacheNode<K, V>>;
  private head: CacheNode<K, V> | null = null;
  private tail: CacheNode<K, V> | null = null;

  constructor(options: CacheOptions<K, V> = {}) {
    this.maxSize = options.maxSize ?? DEFAULT_CACHE_MAX_SIZE;
    this.ttl = options.ttl ?? DEFAULT_CACHE_TTL_MS;
    this.onEvict = options.onEvict;
    this.cache = new Map();
  }

  get(key: K): V | undefined {
    const node = this.cache.get(key);
    if (!node) return undefined;

    if (Date.now() > node.expiresAt) {
      this.delete(key);
      return undefined;
    }

    this.moveToHead(node);
    return node.value;
  }

  set(key: K, value: V): void {
    const existingNode = this.cache.get(key);

    if (existingNode) {
      existingNode.value = value;
      existingNode.expiresAt = Date.now() + this.ttl;
      this.moveToHead(existingNode);
      return;
    }

    const newNode: CacheNode<K, V> = {
      key,
      value,
      prev: null,
      next: null,
      expiresAt: Date.now() + this.ttl,
    };

    this.cache.set(key, newNode);
    this.addToHead(newNode);

    if (this.cache.size > this.maxSize) {
      this.removeTail();
    }
  }

  delete(key: K): boolean {
    const node = this.cache.get(key);
    if (!node) return false;

    this.removeNode(node);
    this.cache.delete(key);
    return true;
  }

  clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
  }

  size(): number {
    return this.cache.size;
  }

  cleanup(): void {
    const now = Date.now();
    const expiredKeys: K[] = [];

    for (const [key, node] of this.cache) {
      if (now > node.expiresAt) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.delete(key));
  }

  private addToHead(node: CacheNode<K, V>): void {
    node.prev = null;
    node.next = this.head;

    if (this.head) {
      this.head.prev = node;
    }

    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  private moveToHead(node: CacheNode<K, V>): void {
    this.removeNode(node);
    this.addToHead(node);
  }

  private removeNode(node: CacheNode<K, V>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
  }

  private removeTail(): void {
    if (!this.tail) return;

    const evictedKey = this.tail.key;
    const evictedValue = this.tail.value;

    this.removeNode(this.tail);
    this.cache.delete(evictedKey);

    this.onEvict?.(evictedKey, evictedValue);
  }
}
