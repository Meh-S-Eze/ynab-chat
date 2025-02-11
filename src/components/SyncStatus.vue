<!-- SyncStatus.vue -->
<template>
  <div class="sync-status-container p-4 bg-white rounded-lg shadow">
    <!-- Status Header -->
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-semibold">Sync Status</h2>
      <div class="flex items-center space-x-2">
        <span class="text-sm text-gray-500">Last sync: {{ formattedLastSync }}</span>
        <div :class="statusIndicatorClass" class="w-3 h-3 rounded-full"></div>
      </div>
    </div>

    <!-- Status Details -->
    <div class="mb-4">
      <div class="grid grid-cols-2 gap-4">
        <div class="bg-gray-50 p-3 rounded">
          <div class="text-sm text-gray-500">Current Status</div>
          <div class="font-medium">{{ currentStatus.status }}</div>
        </div>
        <div class="bg-gray-50 p-3 rounded">
          <div class="text-sm text-gray-500">Pending Items</div>
          <div class="font-medium">{{ pendingCount }}</div>
        </div>
      </div>
    </div>

    <!-- Error Message -->
    <div v-if="currentStatus.error_message" class="mb-4">
      <div class="bg-red-50 text-red-700 p-3 rounded">
        <div class="text-sm font-medium">Error</div>
        <div class="text-sm">{{ currentStatus.error_message }}</div>
      </div>
    </div>

    <!-- Controls -->
    <div class="flex space-x-3">
      <button
        @click="triggerSync"
        :disabled="isSyncing"
        class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center"
      >
        <span v-if="isSyncing" class="mr-2">
          <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </span>
        {{ isSyncing ? 'Syncing...' : 'Sync Now' }}
      </button>
      
      <button
        @click="retryFailed"
        :disabled="isSyncing"
        class="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        Retry Failed
      </button>
    </div>

    <!-- Recent History -->
    <div class="mt-6">
      <h3 class="text-lg font-medium mb-3">Recent History</h3>
      <div class="space-y-2">
        <div v-for="item in recentHistory" :key="item.id" class="bg-gray-50 p-3 rounded">
          <div class="flex justify-between items-start">
            <div>
              <div class="font-medium">{{ item.status }}</div>
              <div class="text-sm text-gray-500">
                {{ new Date(item.started_at).toLocaleString() }}
              </div>
            </div>
            <div class="text-sm">
              {{ item.records_processed }} records
            </div>
          </div>
          <div v-if="item.error_message" class="text-sm text-red-600 mt-1">
            {{ item.error_message }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { syncApi } from '../services/api';

interface SyncStatus {
  id: string;
  last_sync: Date;
  status: string;
  error_message?: string;
  created_at: Date;
  updated_at: Date;
}

const currentStatus = ref<SyncStatus>({
  id: '',
  last_sync: new Date(),
  status: 'idle',
  created_at: new Date(),
  updated_at: new Date()
});
const pendingCount = ref(0);
const recentHistory = ref([]);
let pollInterval: number | null = null;

// Computed properties
const isSyncing = computed(() => currentStatus.value.status === 'in_progress');

const formattedLastSync = computed(() => {
  return new Date(currentStatus.value.last_sync).toLocaleString();
});

const statusIndicatorClass = computed(() => {
  switch (currentStatus.value.status) {
    case 'idle':
      return 'bg-gray-400';
    case 'in_progress':
      return 'bg-blue-400';
    case 'completed':
      return 'bg-green-400';
    case 'failed':
      return 'bg-red-400';
    default:
      return 'bg-gray-400';
  }
});

// Methods
async function loadStatus() {
  try {
    currentStatus.value = await syncApi.getCurrentStatus();
    const pendingItems = await syncApi.getPendingItems();
    pendingCount.value = pendingItems.length;
    recentHistory.value = await syncApi.getRecentHistory();
  } catch (error) {
    console.error('Error loading sync status:', error);
  }
}

async function triggerSync() {
  try {
    await syncApi.triggerSync();
    await loadStatus();
  } catch (error) {
    console.error('Error triggering sync:', error);
  }
}

async function retryFailed() {
  try {
    const result = await syncApi.retryFailedItems();
    if (result.retryCount > 0) {
      await loadStatus();
    }
  } catch (error) {
    console.error('Error retrying failed items:', error);
  }
}

// Lifecycle hooks
onMounted(async () => {
  await loadStatus();
  // Poll for updates every 30 seconds
  pollInterval = window.setInterval(loadStatus, 30000);
});

onUnmounted(() => {
  if (pollInterval !== null) {
    clearInterval(pollInterval);
  }
});
</script>

<style scoped>
.sync-status-container {
  max-width: 800px;
  margin: 0 auto;
}
</style> 