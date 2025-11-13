import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { 
  Workflow, 
  Zap, 
  Users, 
  FolderKanban,
  Activity,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  Boxes
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();
  const { data: connectors } = trpc.mcpConnectors.list.useQuery();
  const { data: workflows } = trpc.workflows.list.useQuery();

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  const activeConnectors = connectors?.filter(c => c.isActive).length || 0;
  const activeWorkflows = workflows?.filter(w => w.status === 'active').length || 0;

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor your workflow orchestration and business operations
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Workflows</CardTitle>
              <Workflow className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalWorkflows || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-primary">{activeWorkflows}</span> active
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">MCP Connectors</CardTitle>
              <Boxes className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalConnectors || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-primary">{activeConnectors}</span> active
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalClients || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Across all stages</p>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalProjects || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">In progress</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Workflow className="h-5 w-5" />
                Recent Workflows
              </CardTitle>
              <CardDescription>Your latest workflow configurations</CardDescription>
            </CardHeader>
            <CardContent>
              {workflows && workflows.length > 0 ? (
                <div className="space-y-4">
                  {workflows.slice(0, 5).map((workflow) => (
                    <div key={workflow.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:border-primary/50 transition-colors">
                      <div className="flex-1">
                        <div className="font-medium">{workflow.name}</div>
                        <div className="text-sm text-muted-foreground">{workflow.description || "No description"}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {workflow.status === 'active' && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs">
                            <Activity className="h-3 w-3" />
                            Active
                          </span>
                        )}
                        {workflow.status === 'paused' && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-500 text-xs">
                            <Clock className="h-3 w-3" />
                            Paused
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Workflow className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">No workflows yet</p>
                  <Button asChild size="sm">
                    <Link href="/workflows">Create Workflow</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                MCP Connector Status
              </CardTitle>
              <CardDescription>Integration health across platforms</CardDescription>
            </CardHeader>
            <CardContent>
              {connectors && connectors.length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(
                    connectors.reduce((acc, c) => {
                      acc[c.category] = (acc[c.category] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>)
                  ).map(([category, count]) => (
                    <div key={category} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-primary"></div>
                        <span className="text-sm capitalize">{category.replace(/_/g, ' ')}</span>
                      </div>
                      <span className="text-sm font-medium">{count} connectors</span>
                    </div>
                  ))}
                  <div className="pt-4 mt-4 border-t border-border/50">
                    <Button asChild variant="outline" className="w-full">
                      <Link href="/connectors">View All Connectors</Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Boxes className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No connectors configured</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Workflow Execution Statistics
            </CardTitle>
            <CardDescription>Performance metrics for automated workflows</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="text-center p-6 rounded-lg border border-border/50">
                <div className="text-3xl font-bold text-primary mb-2">{stats?.totalExecutions || 0}</div>
                <div className="text-sm text-muted-foreground">Total Executions</div>
              </div>
              <div className="text-center p-6 rounded-lg border border-border/50">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                  <div className="text-3xl font-bold">{workflows ? Math.round((workflows.filter(w => w.successCount > 0).length / Math.max(workflows.length, 1)) * 100) : 0}%</div>
                </div>
                <div className="text-sm text-muted-foreground">Success Rate</div>
              </div>
              <div className="text-center p-6 rounded-lg border border-border/50">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Activity className="h-6 w-6 text-primary" />
                  <div className="text-3xl font-bold">{activeWorkflows}</div>
                </div>
                <div className="text-sm text-muted-foreground">Active Workflows</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and operations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Button asChild variant="outline" className="h-auto flex-col gap-2 p-6">
                <Link href="/workflows">
                  <Workflow className="h-8 w-8" />
                  <span>Create Workflow</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-auto flex-col gap-2 p-6">
                <Link href="/clients">
                  <Users className="h-8 w-8" />
                  <span>Add Client</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-auto flex-col gap-2 p-6">
                <Link href="/projects">
                  <FolderKanban className="h-8 w-8" />
                  <span>New Project</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-auto flex-col gap-2 p-6">
                <Link href="/analytics">
                  <TrendingUp className="h-8 w-8" />
                  <span>View Analytics</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
