/**
 * Dispatch & Rider Service
 *
 * Manages dispatchers/riders and their delivery jobs.
 * Backed by Supabase tables defined in `supabase/migrations/0006_vendors_and_dispatch.sql`.
 */

import { getSupabaseAdmin, getSupabaseClient } from '../supabase';

export type DispatchJobStatus =
  | 'assigned'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'cancelled'
  | 'failed';

export interface Dispatcher {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  is_available: boolean;
  current_latitude: string | null;
  current_longitude: string | null;
  current_location_updated_at: string | null;
  region: string | null;
  metadata: any | null;
  created_at: string;
  updated_at: string;
}

export interface DispatchJob {
  id: string;
  order_id: string;
  dispatcher_id: string;
  status: DispatchJobStatus;
  estimated_arrival_time: string | null;
  actual_arrival_time: string | null;
  pickup_latitude: string | null;
  pickup_longitude: string | null;
  delivery_latitude: string | null;
  delivery_longitude: string | null;
  current_latitude: string | null;
  current_longitude: string | null;
  location_updates: any | null;
  notes: string | null;
  metadata: any | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDispatchJobParams {
  orderId: string;
  dispatcherId: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  estimatedArrivalTime?: string;
  metadata?: any;
}

/**
 * Find an available dispatcher in a region.
 * Simple v1 strategy: first active + available dispatcher in the region (or any region if none).
 */
export async function findAvailableDispatcher(
  region?: string
): Promise<Dispatcher | null> {
  const supabase = getSupabaseClient();

  let query = supabase
    .from('dispatchers')
    .select('*')
    .eq('is_active', true)
    .eq('is_available', true)
    .order('created_at', { ascending: true })
    .limit(1);

  if (region) {
    query = query.eq('region', region);
  }

  const { data, error } = await query;

  if (error) {
    console.error(
      '[Dispatch Service] Error finding available dispatcher:',
      error
    );
    return null;
  }

  if (!data || !data.length) {
    // No dispatcher in region, try without region as a fallback
    if (region) {
      return findAvailableDispatcher(undefined);
    }
    return null;
  }

  return data[0] as Dispatcher;
}

/**
 * Create a new dispatch job for an order.
 * Also sets dispatcher as not available (they are now on a job).
 */
export async function createDispatchJob(
  params: CreateDispatchJobParams
): Promise<DispatchJob> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const payload: any = {
    order_id: params.orderId,
    dispatcher_id: params.dispatcherId,
    status: 'assigned',
    pickup_latitude:
      typeof params.pickupLatitude === 'number' ? params.pickupLatitude : null,
    pickup_longitude:
      typeof params.pickupLongitude === 'number' ? params.pickupLongitude : null,
    delivery_latitude:
      typeof params.deliveryLatitude === 'number'
        ? params.deliveryLatitude
        : null,
    delivery_longitude:
      typeof params.deliveryLongitude === 'number'
        ? params.deliveryLongitude
        : null,
    estimated_arrival_time: params.estimatedArrivalTime ?? null,
    metadata: params.metadata ?? null,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from('dispatch_jobs')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('[Dispatch Service] Error creating dispatch job:', error);
    throw new Error(`Failed to create dispatch job: ${error.message}`);
  }

  // Mark dispatcher as not available
  const { error: dispatcherError } = await supabase
    .from('dispatchers')
    .update({
      is_available: false,
      updated_at: now,
    })
    .eq('id', params.dispatcherId);

  if (dispatcherError) {
    console.error(
      '[Dispatch Service] Error updating dispatcher availability:',
      dispatcherError
    );
  }

  return data as DispatchJob;
}

/**
 * Update a dispatch job status and optionally the dispatcher's availability.
 */
export async function updateDispatchJobStatus(params: {
  jobId: string;
  status: DispatchJobStatus;
  estimatedArrivalTime?: string | null;
  actualArrivalTime?: string | null;
  currentLatitude?: number;
  currentLongitude?: number;
  notes?: string;
  metadataPatch?: Record<string, any>;
  markDispatcherAvailable?: boolean;
}): Promise<DispatchJob> {
  const {
    jobId,
    status,
    estimatedArrivalTime,
    actualArrivalTime,
    currentLatitude,
    currentLongitude,
    notes,
    metadataPatch,
    markDispatcherAvailable,
  } = params;

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const updates: any = {
    status,
    updated_at: now,
  };

  if (typeof estimatedArrivalTime !== 'undefined') {
    updates.estimated_arrival_time = estimatedArrivalTime;
  }
  if (typeof actualArrivalTime !== 'undefined') {
    updates.actual_arrival_time = actualArrivalTime;
  }
  if (typeof currentLatitude === 'number') {
    updates.current_latitude = currentLatitude;
  }
  if (typeof currentLongitude === 'number') {
    updates.current_longitude = currentLongitude;
  }
  if (typeof notes === 'string') {
    updates.notes = notes;
  }
  if (metadataPatch) {
    updates.metadata = metadataPatch;
  }

  const { data, error } = await supabase
    .from('dispatch_jobs')
    .update(updates)
    .eq('id', jobId)
    .select()
    .single();

  if (error) {
    console.error('[Dispatch Service] Error updating dispatch job:', error);
    throw new Error(`Failed to update dispatch job: ${error.message}`);
  }

  if (markDispatcherAvailable) {
    const job = data as DispatchJob;
    const { error: dispatcherError } = await supabase
      .from('dispatchers')
      .update({
        is_available: true,
        updated_at: now,
      })
      .eq('id', job.dispatcher_id);

    if (dispatcherError) {
      console.error(
        '[Dispatch Service] Error marking dispatcher available:',
        dispatcherError
      );
    }
  }

  return data as DispatchJob;
}


