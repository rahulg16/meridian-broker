/**
 * src/screens/profile/index.tsx
 *
 * Profile screen for the Meridian Broker platform.
 *
 * Renders:
 * 1. User profile card — avatar, name, email, KYC status, account tier.
 * 2. Wallet section — cash wallet, buying power, total equity, margin used.
 * 3. Settings section — theme (light/dark/system), notifications, default order size.
 * 4. Destructive logout button.
 *
 * State layering:
 * - Theme is the ONLY Zustand state, read via `useTheme()` from '@/store/theme'.
 * - Notifications toggle and default order size are local React `useState`.
 * - User data is mock data; production loads it via TanStack Query + IndexedDB.
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ShieldCheck,
  Crown,
  LogOut,
  Sun,
  Moon,
  Settings,
  Bell,
  CreditCard,
} from 'lucide-react';
import { Shell } from '@/components/layout/shell';
import { useTheme } from '@/store/theme';
import type { Theme } from '@/types/broker';

export default function Profile() {
  const { theme, setTheme } = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [defaultOrderSize, setDefaultOrderSize] = useState('100');

  const handleThemeChange = (value: Theme): void => {
    setTheme(value);
  };

  const handleLogout = (): void => {
    window.dispatchEvent(new CustomEvent('meridian:logout'));
  };

  return (
    <Shell>
      <div className="max-w-3xl mx-auto space-y-6 pb-24">
        <Card className="p-4">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-broker-surface border border-broker-surface flex items-center justify-center text-broker-text text-xs font-medium">
                RG
              </div>
              <div className="flex flex-col">
                <p className="text-xs font-medium text-broker-text">
                  Rahul Gangadharan
                </p>
                <p className="text-xs text-broker-muted">rahul@example.com</p>
              </div>
            </div>
            <Badge variant="success" className="ml-2">
              <ShieldCheck className="mr-1 h-3 w-3" />
              Verified
            </Badge>
            <Badge variant="warn" className="ml-2">
              <Crown className="mr-1 h-3 w-3" />
              Gold Tier
            </Badge>
          </CardHeader>
        </Card>

        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Wallet</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 p-4">
              <div className="bg-broker-panel border border-broker-surface rounded-lg p-4">
                <div className="text-xs text-broker-muted uppercase">
                  Cash wallet
                </div>
                <div className="text-sm font-mono font-semibold text-broker-text">
                  $124,582.30
                </div>
              </div>
              <div className="bg-broker-panel border border-broker-surface rounded-lg p-4">
                <div className="text-xs text-broker-muted uppercase">
                  Buying power
                </div>
                <div className="text-sm font-mono font-semibold text-broker-text">
                  $124,582.30
                </div>
              </div>
              <div className="bg-broker-panel border border-broker-surface rounded-lg p-4">
                <div className="text-xs text-broker-muted uppercase">
                  Total equity
                </div>
                <div className="text-sm font-mono font-semibold text-broker-text">
                  $150,234.50
                </div>
              </div>
              <div className="bg-broker-panel border border-broker-surface rounded-lg p-4">
                <div className="text-xs text-broker-muted uppercase">
                  Margin used
                </div>
                <div className="text-sm font-mono font-semibold text-broker-red">
                  $0.00
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Settings</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Sun className="h-5 w-5 text-broker-muted" />
                  <span className="text-sm text-broker-muted">Light</span>
                </div>
                <div className="flex-1"></div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={theme === 'light'}
                    onCheckedChange={() => handleThemeChange('light')}
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Moon className="h-5 w-5 text-broker-muted" />
                  <span className="text-sm text-broker-muted">Dark</span>
                </div>
                <div className="flex-1"></div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={theme === 'dark'}
                    onCheckedChange={() => handleThemeChange('dark')}
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-broker-muted" />
                  <span className="text-sm text-broker-muted">System</span>
                </div>
                <div className="flex-1"></div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={theme === 'system'}
                    onCheckedChange={() => handleThemeChange('system')}
                  />
                </div>
              </div>
              <Separator className="my-4" />
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-broker-muted" />
                  <span className="text-sm text-broker-muted">Notifications</span>
                </div>
                <div className="flex-1"></div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={notificationsEnabled}
                    onCheckedChange={setNotificationsEnabled}
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-broker-muted" />
                  <span className="text-sm text-broker-muted">
                    Default order size
                  </span>
                </div>
                <div className="flex-1"></div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={defaultOrderSize}
                    onChange={(event) =>
                      setDefaultOrderSize(event.target.value)
                    }
                    placeholder="e.g. 100"
                    className="w-48"
                  />
                  <p className="text-xs text-broker-muted">
                    Shares per order when using quick-trade buttons.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button
          type="button"
          variant="destructive"
          onClick={handleLogout}
          className="w-full"
        >
          <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
          Log out
        </Button>
      </div>
    </Shell>
  );
}