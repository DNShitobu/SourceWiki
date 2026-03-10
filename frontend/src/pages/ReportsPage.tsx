import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Clock3, FileCheck, Globe2, Users, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { reportsApi } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { toast } from 'sonner';

interface OverviewReport {
  period: {
    startDate: string;
    endDate: string;
    country: string;
  };
  summary: {
    totalSubmissions: number;
    approvedSubmissions: number;
    rejectedSubmissions: number;
    pendingSubmissions: number;
    newUsers: number;
    activeCountries: number;
    approvalRate: number;
  };
  breakdown: {
    byCategory: Array<{ _id: string; count: number }>;
    byCountry: Array<{ _id: string; submissions: number; approved: number }>;
    topContributors: Array<{ username: string; country: string; submissions: number; approved: number }>;
    verificationSpeed: {
      avgDays: number;
      minDays: number;
      maxDays: number;
      totalProcessed: number;
    };
  };
}

const toInputDate = (value: Date) => value.toISOString().split('T')[0];

export const ReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<OverviewReport | null>(null);
  const [startDate, setStartDate] = useState(toInputDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));
  const [endDate, setEndDate] = useState(toInputDate(new Date()));
  const [country, setCountry] = useState('');

  const loadReport = async () => {
    setLoading(true);
    try {
      const response = await reportsApi.getOverview({
        startDate,
        endDate,
        country: country || undefined,
      });
      setReport(response);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && (user.role === 'admin' || user.role === 'verifier')) {
      loadReport();
    }
  }, [user]);

  if (!user || (user.role !== 'admin' && user.role !== 'verifier')) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Reports are available to verifiers and admins.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/')}>Go to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-8">
      <div>
        <h1 className="mb-2">Operational Reports</h1>
        <p className="text-gray-600">
          Review queue health, contributor activity, and verification performance.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report Filters</CardTitle>
          <CardDescription>Use a date window and optional country code.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[1fr_1fr_180px_auto]">
          <div className="space-y-2">
            <Label htmlFor="report-start-date">Start date</Label>
            <Input id="report-start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-end-date">End date</Label>
            <Input id="report-end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-country">Country</Label>
            <Input
              id="report-country"
              placeholder="US, GB, NG..."
              value={country}
              onChange={(e) => setCountry(e.target.value.toUpperCase())}
              maxLength={2}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={loadReport} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading
                </>
              ) : (
                'Refresh'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : report ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total submissions</p>
                    <p className="text-2xl font-bold">{report.summary.totalSubmissions}</p>
                  </div>
                  <FileCheck className="h-7 w-7 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Approval rate</p>
                    <p className="text-2xl font-bold">{report.summary.approvalRate}%</p>
                  </div>
                  <BarChart3 className="h-7 w-7 text-green-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">New users</p>
                    <p className="text-2xl font-bold">{report.summary.newUsers}</p>
                  </div>
                  <Users className="h-7 w-7 text-purple-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Active countries</p>
                    <p className="text-2xl font-bold">{report.summary.activeCountries}</p>
                  </div>
                  <Globe2 className="h-7 w-7 text-amber-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Category Breakdown</CardTitle>
                <CardDescription>Submission volume by source class.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {report.breakdown.byCategory.length === 0 ? (
                  <p className="text-sm text-gray-500">No category data for this period.</p>
                ) : (
                  report.breakdown.byCategory.map((entry) => (
                    <div key={entry._id} className="flex items-center justify-between rounded border px-3 py-2">
                      <span className="capitalize">{entry._id}</span>
                      <span className="font-semibold">{entry.count}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Verification Speed</CardTitle>
                <CardDescription>Current turnaround from submission to review.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 rounded border px-3 py-3">
                  <Clock3 className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-500">Average</p>
                    <p className="font-semibold">
                      {report.breakdown.verificationSpeed.avgDays.toFixed(1)} days
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded border px-3 py-3">
                    <p className="text-sm text-gray-500">Fastest</p>
                    <p className="font-semibold">{report.breakdown.verificationSpeed.minDays.toFixed(1)} days</p>
                  </div>
                  <div className="rounded border px-3 py-3">
                    <p className="text-sm text-gray-500">Slowest</p>
                    <p className="font-semibold">{report.breakdown.verificationSpeed.maxDays.toFixed(1)} days</p>
                  </div>
                </div>
                <div className="rounded border px-3 py-3">
                  <p className="text-sm text-gray-500">Processed</p>
                  <p className="font-semibold">{report.breakdown.verificationSpeed.totalProcessed}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top Countries</CardTitle>
                <CardDescription>Highest submission volume in the selected window.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {report.breakdown.byCountry.length === 0 ? (
                  <p className="text-sm text-gray-500">No country data for this period.</p>
                ) : (
                  report.breakdown.byCountry.map((entry) => (
                    <div key={entry._id} className="flex items-center justify-between rounded border px-3 py-2">
                      <div>
                        <p className="font-medium">{entry._id}</p>
                        <p className="text-xs text-gray-500">{entry.approved} approved</p>
                      </div>
                      <span className="font-semibold">{entry.submissions}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Contributors</CardTitle>
                <CardDescription>Most active submitters in the current window.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {report.breakdown.topContributors.length === 0 ? (
                  <p className="text-sm text-gray-500">No contributor data for this period.</p>
                ) : (
                  report.breakdown.topContributors.map((entry) => (
                    <div key={`${entry.username}-${entry.country}`} className="flex items-center justify-between rounded border px-3 py-2">
                      <div>
                        <p className="font-medium">{entry.username || 'Unknown user'}</p>
                        <p className="text-xs text-gray-500">{entry.country || 'GLOBAL'}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{entry.submissions}</p>
                        <p className="text-xs text-gray-500">{entry.approved} approved</p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            No report data available.
          </CardContent>
        </Card>
      )}
    </div>
  );
};
