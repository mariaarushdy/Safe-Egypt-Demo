import { fetchIncidentVideo, fetchIncidentImage } from '@/lib/api';
import { persistentMediaCache } from './persistentMediaCache';

type MediaType = 'video' | 'image';

interface CacheEntry {
  blob: Blob;
  url: string;
  timestamp: number;
  size: number;
  type: MediaType;
}

class MediaCacheService {
  private cache: Map<string, CacheEntry> = new Map();
  private maxCacheSize: number = 1024 * 1024 * 1024; // 1GB max
  private maxAge: number = 30 * 60 * 1000; // 30 minutes
  private currentCacheSize: number = 0;

  async getMedia(
    incidentId: string, 
    filePath: string, 
    type: MediaType
  ): Promise<string> {
    const cacheKey = `${type}-${incidentId}-${filePath}`;
    
    // 1. Check in-memory cache first
    if (this.cache.has(cacheKey)) {
      const entry = this.cache.get(cacheKey)!;
      if (Date.now() - entry.timestamp < this.maxAge) {
        console.log(`📦 ${type.toUpperCase()} Memory Cache HIT:`, cacheKey);
        return entry.url;
      } else {
        this.removeFromCache(cacheKey);
      }
    }

    // 2. Check IndexedDB persistent cache
    let cachedBlob: Blob | null = null;
    if (type === 'video') {
      cachedBlob = await persistentMediaCache.getVideo(incidentId, filePath);
    } else {
      cachedBlob = await persistentMediaCache.getImage(incidentId, filePath);
    }

    if (cachedBlob) {
      console.log(`💾 ${type.toUpperCase()} IndexedDB Cache HIT:`, cacheKey);
      return this.addToCache(cacheKey, cachedBlob, type);
    }

    // 3. Fetch from network
    console.log(`🌐 ${type.toUpperCase()} Network Fetch:`, cacheKey);
    const blob = type === 'video' 
      ? await fetchIncidentVideo(incidentId, filePath)
      : await fetchIncidentImage(incidentId, filePath);
    
    // Save to IndexedDB for future sessions
    if (type === 'video') {
      await persistentMediaCache.setVideo(incidentId, filePath, blob);
    } else {
      await persistentMediaCache.setImage(incidentId, filePath, blob);
    }
    
    return this.addToCache(cacheKey, blob, type);
  }

  async getVideo(incidentId: string, filePath: string): Promise<string> {
    return this.getMedia(incidentId, filePath, 'video');
  }

  async getImage(incidentId: string, imagePath: string): Promise<string> {
    return this.getMedia(incidentId, imagePath, 'image');
  }

  async getImagesBatch(
    incidentId: string, 
    imagePaths: string[]
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    
    // First, try to load from IndexedDB batch
    const cachedImages = await persistentMediaCache.getImagesBatch(incidentId, imagePaths);
    const remainingPaths: string[] = [];
    
    // Process cached images
    for (const [path, blob] of cachedImages.entries()) {
      const cacheKey = `image-${incidentId}-${path}`;
      const url = this.addToCache(cacheKey, blob, 'image');
      results.set(path, url);
    }
    
    // Find remaining paths that weren't cached
    for (const path of imagePaths) {
      if (!results.has(path)) {
        remainingPaths.push(path);
      }
    }
    
    // Load remaining images from network with concurrency limit
    const batchSize = 5; // Load 5 at a time
    for (let i = 0; i < remainingPaths.length; i += batchSize) {
      const batch = remainingPaths.slice(i, i + batchSize);
      const promises = batch.map(path => 
        this.getImage(incidentId, path)
          .then(url => ({ path, url }))
          .catch(err => {
            console.warn(`Failed to load image ${path}:`, err);
            return null;
          })
      );
      
      const batchResults = await Promise.all(promises);
      batchResults.forEach(result => {
        if (result) {
          results.set(result.path, result.url);
        }
      });
    }
    
    return results;
  }

  private addToCache(key: string, blob: Blob, type: MediaType): string {
    // Evict if cache is full
    while (this.currentCacheSize + blob.size > this.maxCacheSize && this.cache.size > 0) {
      this.evictOldest();
    }

    const url = URL.createObjectURL(blob);
    const entry: CacheEntry = {
      blob,
      url,
      timestamp: Date.now(),
      size: blob.size,
      type
    };

    this.cache.set(key, entry);
    this.currentCacheSize += blob.size;
    
    console.log(`✅ Added ${type} to cache: ${key} (${(blob.size / 1024 / 1024).toFixed(2)}MB)`);
    
    return url;
  }

  private removeFromCache(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      URL.revokeObjectURL(entry.url);
      this.currentCacheSize -= entry.size;
      this.cache.delete(key);
      console.log(`🗑️ Removed ${entry.type} from cache: ${key}`);
    }
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      console.log(`⏰ Evicting oldest: ${oldestKey}`);
      this.removeFromCache(oldestKey);
    }
  }

  clearAll(): void {
    for (const entry of this.cache.values()) {
      URL.revokeObjectURL(entry.url);
    }
    this.cache.clear();
    this.currentCacheSize = 0;
    console.log('🧹 Media cache cleared');
  }

  clearByType(type: MediaType): void {
    const keysToDelete: string[] = [];
    for (const [key, entry] of this.cache.entries()) {
      if (entry.type === type) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.removeFromCache(key));
    console.log(`🧹 Cleared all ${type}s from cache`);
  }

  getStats() {
    const videoEntries = Array.from(this.cache.values()).filter(e => e.type === 'video');
    const imageEntries = Array.from(this.cache.values()).filter(e => e.type === 'image');
    
    const videoSize = videoEntries.reduce((sum, e) => sum + e.size, 0);
    const imageSize = imageEntries.reduce((sum, e) => sum + e.size, 0);
    
    return {
      total: {
        entries: this.cache.size,
        size: this.currentCacheSize,
        sizeMB: parseFloat((this.currentCacheSize / 1024 / 1024).toFixed(2)),
        utilizationPercent: (this.currentCacheSize / this.maxCacheSize) * 100
      },
      videos: {
        count: videoEntries.length,
        size: videoSize,
        sizeMB: parseFloat((videoSize / 1024 / 1024).toFixed(2))
      },
      images: {
        count: imageEntries.length,
        size: imageSize,
        sizeMB: parseFloat((imageSize / 1024 / 1024).toFixed(2))
      }
    };
  }

  async preloadIncidentMedia(incidentId: string, incidentData: { real_files?: string[]; detected_events?: Array<{ image_path?: string }> }): Promise<void> {
    console.log('🔄 Preloading media for incident:', incidentId);
    
    const promises: Promise<unknown>[] = [];
    
    // Preload video
    if (incidentData.real_files && incidentData.real_files.length > 0) {
      promises.push(
        this.getVideo(incidentId, incidentData.real_files[0])
          .catch((err: unknown) => console.warn('Video preload failed:', err))
      );
    }
    
    // Preload all scene images
    const imagePaths = incidentData.detected_events
      ?.map((event) => event.image_path)
      .filter(Boolean) || [];
    
    if (imagePaths.length > 0) {
      promises.push(
        this.getImagesBatch(incidentId, imagePaths)
          .catch((err: unknown) => console.warn('Images preload failed:', err))
      );
    }
    
    await Promise.allSettled(promises);
    console.log('✅ Media preloading complete for incident:', incidentId);
  }
}

export const mediaCacheService = new MediaCacheService();

