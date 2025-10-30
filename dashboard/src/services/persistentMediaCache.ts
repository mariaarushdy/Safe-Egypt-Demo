import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface MediaDBSchema extends DBSchema {
  videos: {
    key: string;
    value: {
      incidentId: string;
      filePath: string;
      blob: Blob;
      timestamp: number;
      size: number;
    };
  };
  images: {
    key: string;
    value: {
      incidentId: string;
      imagePath: string;
      blob: Blob;
      timestamp: number;
      size: number;
    };
  };
}

class PersistentMediaCache {
  private dbName = 'SafeEgyptMedia';
  private db: IDBPDatabase<MediaDBSchema> | null = null;
  private maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

  async init() {
    if (this.db) return;
    
    this.db = await openDB<MediaDBSchema>(this.dbName, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('videos')) {
          db.createObjectStore('videos');
        }
        if (!db.objectStoreNames.contains('images')) {
          db.createObjectStore('images');
        }
      },
    });
  }

  async getVideo(incidentId: string, filePath: string): Promise<Blob | null> {
    await this.init();
    if (!this.db) return null;
    
    const key = `${incidentId}-${filePath}`;
    const entry = await this.db.get('videos', key);
    
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.maxAge) {
      await this.db.delete('videos', key);
      return null;
    }
    
    console.log('💾 IndexedDB Video Cache HIT:', key);
    return entry.blob;
  }

  async setVideo(incidentId: string, filePath: string, blob: Blob): Promise<void> {
    await this.init();
    if (!this.db) return;
    
    const key = `${incidentId}-${filePath}`;
    await this.db.put('videos', {
      incidentId,
      filePath,
      blob,
      timestamp: Date.now(),
      size: blob.size,
    }, key);
    
    console.log('💾 Saved video to IndexedDB:', key);
  }

  async getImage(incidentId: string, imagePath: string): Promise<Blob | null> {
    await this.init();
    if (!this.db) return null;
    
    const key = `${incidentId}-${imagePath}`;
    const entry = await this.db.get('images', key);
    
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.maxAge) {
      await this.db.delete('images', key);
      return null;
    }
    
    console.log('💾 IndexedDB Image Cache HIT:', key);
    return entry.blob;
  }

  async setImage(incidentId: string, imagePath: string, blob: Blob): Promise<void> {
    await this.init();
    if (!this.db) return;
    
    const key = `${incidentId}-${imagePath}`;
    await this.db.put('images', {
      incidentId,
      imagePath,
      blob,
      timestamp: Date.now(),
      size: blob.size,
    }, key);
    
    console.log('💾 Saved image to IndexedDB:', key);
  }

  async getImagesBatch(incidentId: string, imagePaths: string[]): Promise<Map<string, Blob>> {
    await this.init();
    if (!this.db) return new Map();
    
    const results = new Map<string, Blob>();
    
    for (const imagePath of imagePaths) {
      const blob = await this.getImage(incidentId, imagePath);
      if (blob) {
        results.set(imagePath, blob);
      }
    }
    
    return results;
  }

  async setImagesBatch(incidentId: string, images: Map<string, Blob>): Promise<void> {
    const promises: Promise<void>[] = [];
    
    for (const [imagePath, blob] of images.entries()) {
      promises.push(this.setImage(incidentId, imagePath, blob));
    }
    
    await Promise.all(promises);
  }

  async clearOld(): Promise<void> {
    await this.init();
    if (!this.db) return;
    
    // Clear old videos
    const videoKeys = await this.db.getAllKeys('videos');
    for (const key of videoKeys) {
      const entry = await this.db.get('videos', key);
      if (entry && Date.now() - entry.timestamp > this.maxAge) {
        await this.db.delete('videos', key as string);
      }
    }
    
    // Clear old images
    const imageKeys = await this.db.getAllKeys('images');
    for (const key of imageKeys) {
      const entry = await this.db.get('images', key);
      if (entry && Date.now() - entry.timestamp > this.maxAge) {
        await this.db.delete('images', key as string);
      }
    }
    
    console.log('🧹 Cleared old media from IndexedDB');
  }

  async clearAll(): Promise<void> {
    await this.init();
    if (!this.db) return;
    await this.db.clear('videos');
    await this.db.clear('images');
    console.log('🧹 Cleared all media from IndexedDB');
  }

  async getStats() {
    await this.init();
    if (!this.db) {
      return {
        videos: { count: 0, totalSize: 0, totalSizeMB: '0.00' },
        images: { count: 0, totalSize: 0, totalSizeMB: '0.00' },
        total: { count: 0, totalSize: 0, totalSizeMB: '0.00' }
      };
    }
    
    const videos = await this.db.getAll('videos');
    const images = await this.db.getAll('images');
    
    const videoSize = videos.reduce((sum, entry) => sum + entry.size, 0);
    const imageSize = images.reduce((sum, entry) => sum + entry.size, 0);
    
    return {
      videos: {
        count: videos.length,
        totalSize: videoSize,
        totalSizeMB: (videoSize / 1024 / 1024).toFixed(2),
      },
      images: {
        count: images.length,
        totalSize: imageSize,
        totalSizeMB: (imageSize / 1024 / 1024).toFixed(2),
      },
      total: {
        count: videos.length + images.length,
        totalSize: videoSize + imageSize,
        totalSizeMB: ((videoSize + imageSize) / 1024 / 1024).toFixed(2),
      }
    };
  }
}

export const persistentMediaCache = new PersistentMediaCache();

