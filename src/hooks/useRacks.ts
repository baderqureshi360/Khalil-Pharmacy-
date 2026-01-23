import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Rack {
  id: string;
  name: string;
  color: string;
  description: string | null;
  created_at: string;
}

export function useRacks() {
  const [racks, setRacks] = useState<Rack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Maximum number of records to fetch per query (pagination limit)
  const MAX_RECORDS_PER_QUERY = 1000;

  const fetchRacks = useCallback(async () => {
    try {
      setError(null);
      const { data, error: queryError } = await supabase
        .from('racks')
        .select('*')
        .order('name')
        .limit(MAX_RECORDS_PER_QUERY);
      
      if (queryError) {
        throw queryError;
      }
      
      // Defensive null handling
      setRacks(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load racks';
      console.error('Error fetching racks:', err);
      setError(errorMessage);
      toast.error('Failed to load racks');
      setRacks([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRacks();
  }, [fetchRacks]);

  const addRack = async (name: string, color: string, description?: string) => {
    try {
      if (!name || typeof name !== 'string' || name.trim() === '') {
        toast.error('Rack name is required');
        return null;
      }
      if (!color || typeof color !== 'string') {
        toast.error('Rack color is required');
        return null;
      }

      const { data, error: insertError } = await supabase
        .from('racks')
        .insert({ name: name.trim(), color, description: description?.trim() || null })
        .select()
        .single();
      
      if (insertError) {
        if (insertError.code === '23505') {
          toast.error('Rack name already exists');
          return null;
        }
        throw insertError;
      }
      
      if (!data) {
        toast.error('Rack was not created');
        return null;
      }
      
      setRacks((prev) => {
        const updated = [...prev, data];
        return updated.sort((a, b) => a.name.localeCompare(b.name));
      });
      toast.success('Rack added successfully');
      return data;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add rack';
      console.error('Error adding rack:', err);
      toast.error(errorMessage);
      return null;
    }
  };

  const updateRack = async (id: string, updates: Partial<Rack>) => {
    try {
      if (!id || typeof id !== 'string') {
        toast.error('Invalid rack ID');
        return false;
      }

      const { error: updateError } = await supabase
        .from('racks')
        .update(updates)
        .eq('id', id);
      
      if (updateError) {
        throw updateError;
      }
      
      setRacks((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
      );
      toast.success('Rack updated');
      return true;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update rack';
      console.error('Error updating rack:', err);
      toast.error(errorMessage);
      return false;
    }
  };

  const deleteRack = async (id: string) => {
    try {
      if (!id || typeof id !== 'string') {
        toast.error('Invalid rack ID');
        return false;
      }

      const { error: deleteError } = await supabase
        .from('racks')
        .delete()
        .eq('id', id);
      
      if (deleteError) {
        throw deleteError;
      }
      
      setRacks((prev) => prev.filter((r) => r.id !== id));
      toast.success('Rack deleted');
      return true;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete rack';
      console.error('Error deleting rack:', err);
      toast.error(errorMessage);
      return false;
    }
  };

  return {
    racks,
    loading,
    error,
    addRack,
    updateRack,
    deleteRack,
    refetch: fetchRacks,
  };
}
