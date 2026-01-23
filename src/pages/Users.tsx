import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Users as UsersIcon, Shield, User, Edit2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Navigate } from 'react-router-dom';

interface UserWithRole {
  id: string;
  full_name: string;
  phone: string | null;
  id_card_number: string | null;
  address: string | null;
  email?: string;
  role: 'admin' | 'cashier';
  can_add_products: boolean;
  created_at: string;
}

export default function Users() {
  const { isAdmin, user } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone: '',
    id_card_number: '',
    address: '',
    can_add_products: false,
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      // Get profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at');

      if (profilesError) throw profilesError;

      // Get roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      // Combine data
      const combined = profiles?.map((profile) => {
        const userRole = roles?.find((r) => r.user_id === profile.id);
        return {
          ...profile,
          role: userRole?.role || 'cashier',
          can_add_products: userRole?.can_add_products || false,
        };
      }) || [];

      setUsers(combined as UserWithRole[]);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load users';
      console.error('Error fetching users:', err);
      toast.error(errorMessage);
      setUsers([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (user: UserWithRole) => {
    setEditingUser(user);
    setEditForm({
      full_name: user.full_name,
      phone: user.phone || '',
      id_card_number: user.id_card_number || '',
      address: user.address || '',
      can_add_products: user.can_add_products,
    });
  };

  const handleUpdate = async () => {
    if (!editingUser) return;

    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: editForm.full_name,
          phone: editForm.phone || null,
          id_card_number: editForm.id_card_number || null,
          address: editForm.address || null,
        })
        .eq('id', editingUser.id);

      if (profileError) throw profileError;

      // Update role permissions (only can_add_products for cashiers)
      if (editingUser.role === 'cashier') {
        const { error: roleError } = await supabase
          .from('user_roles')
          .update({ can_add_products: editForm.can_add_products })
          .eq('user_id', editingUser.id);

        if (roleError) throw roleError;
      }

      toast.success('User updated successfully');
      setEditingUser(null);
      fetchUsers();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update user';
      console.error('Error updating user:', err);
      toast.error(errorMessage);
    }
  };

  const toggleProductPermission = async (userId: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ can_add_products: !currentValue })
        .eq('user_id', userId);

      if (error) throw error;

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, can_add_products: !currentValue } : u
        )
      );
      toast.success('Permission updated');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update permission';
      console.error('Error updating permission:', err);
      toast.error(errorMessage);
    }
  };

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="page-header">
        <h1 className="page-title flex items-center gap-3">
          <UsersIcon className="w-8 h-8 text-primary" />
          User Management
        </h1>
        <p className="page-subtitle">Manage staff accounts and permissions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-xl">
                <UsersIcon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{users.length}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-warning/10 rounded-xl">
                <Shield className="w-6 h-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {users.filter((u) => u.role === 'admin').length}
                </p>
                <p className="text-sm text-muted-foreground">Admins</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-success/10 rounded-xl">
                <User className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {users.filter((u) => u.role === 'cashier').length}
                </p>
                <p className="text-sm text-muted-foreground">Cashiers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="table-header">Name</TableHead>
                  <TableHead className="table-header">Role</TableHead>
                  <TableHead className="table-header">Phone</TableHead>
                  <TableHead className="table-header">ID Card</TableHead>
                  <TableHead className="table-header">Can Add Products</TableHead>
                  <TableHead className="table-header">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{u.full_name}</p>
                        {u.id === user?.id && (
                          <span className="text-xs text-muted-foreground">(You)</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={u.role === 'admin' ? 'default' : 'secondary'}
                        className="capitalize"
                      >
                        {u.role === 'admin' && <Shield className="w-3 h-3 mr-1" />}
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.phone || '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.id_card_number || '-'}
                    </TableCell>
                    <TableCell>
                      {u.role === 'cashier' ? (
                        <Switch
                          checked={u.can_add_products}
                          onCheckedChange={() =>
                            toggleProductPermission(u.id, u.can_add_products)
                          }
                        />
                      ) : (
                        <Badge variant="outline">Always</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEdit(u)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={editForm.full_name}
                onChange={(e) =>
                  setEditForm({ ...editForm, full_name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                value={editForm.phone}
                onChange={(e) =>
                  setEditForm({ ...editForm, phone: e.target.value })
                }
                placeholder="e.g., +92 300 1234567"
              />
            </div>
            <div className="space-y-2">
              <Label>ID Card Number</Label>
              <Input
                value={editForm.id_card_number}
                onChange={(e) =>
                  setEditForm({ ...editForm, id_card_number: e.target.value })
                }
                placeholder="e.g., 12345-1234567-1"
              />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={editForm.address}
                onChange={(e) =>
                  setEditForm({ ...editForm, address: e.target.value })
                }
                placeholder="Full address"
              />
            </div>
            {editingUser?.role === 'cashier' && (
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">Can Add Products</p>
                  <p className="text-sm text-muted-foreground">
                    Allow this cashier to create new products
                  </p>
                </div>
                <Switch
                  checked={editForm.can_add_products}
                  onCheckedChange={(checked) =>
                    setEditForm({ ...editForm, can_add_products: checked })
                  }
                />
              </div>
            )}
            <Button onClick={handleUpdate} className="w-full">
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
