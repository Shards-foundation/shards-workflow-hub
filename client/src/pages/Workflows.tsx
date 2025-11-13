import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Activity, Clock, Play, Pause, Trash2, Plus, CheckCircle2, XCircle, Workflow as WorkflowIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Workflows() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [schedule, setSchedule] = useState("");

  const { data: workflows, isLoading, refetch } = trpc.workflows.list.useQuery();
  const createWorkflow = trpc.workflows.create.useMutation({
    onSuccess: () => {
      toast.success("Workflow created successfully");
      refetch();
      setOpen(false);
      setName("");
      setDescription("");
      setSchedule("");
    },
    onError: (error) => {
      toast.error(`Failed to create workflow: ${error.message}`);
    }
  });

  const updateStatus = trpc.workflows.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Workflow status updated");
      refetch();
    }
  });

  const deleteWorkflow = trpc.workflows.delete.useMutation({
    onSuccess: () => {
      toast.success("Workflow deleted");
      refetch();
    }
  });

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error("Workflow name is required");
      return;
    }
    createWorkflow.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      schedule: schedule.trim() || undefined,
      config: {}
    });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Workflows</h1>
            <p className="text-muted-foreground">
              Create and manage automated workflows
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Workflow
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Workflow</DialogTitle>
                <DialogDescription>
                  Set up a new automated workflow
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="Client Onboarding Workflow"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Automated workflow for onboarding new clients"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="schedule">Schedule (Cron Expression)</Label>
                  <Input
                    id="schedule"
                    placeholder="0 9 * * 1-5 (Weekdays at 9 AM)"
                    value={schedule}
                    onChange={(e) => setSchedule(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={createWorkflow.isPending}>
                  {createWorkflow.isPending ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {workflows && workflows.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {workflows.map((workflow) => (
              <Card key={workflow.id} className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <WorkflowIcon className="h-5 w-5" />
                        {workflow.name}
                      </CardTitle>
                      <CardDescription className="mt-2">
                        {workflow.description || "No description"}
                      </CardDescription>
                    </div>
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
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Executions</div>
                      <div className="font-medium">{workflow.executionCount}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Success</div>
                      <div className="font-medium flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        {workflow.successCount}
                      </div>
                    </div>
                  </div>
                  {workflow.schedule && (
                    <div className="text-sm">
                      <div className="text-muted-foreground">Schedule</div>
                      <div className="font-mono text-xs mt-1 p-2 rounded bg-muted">
                        {workflow.schedule}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    {workflow.status === 'active' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => updateStatus.mutate({ id: workflow.id, status: 'paused' })}
                      >
                        <Pause className="h-4 w-4 mr-1" />
                        Pause
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => updateStatus.mutate({ id: workflow.id, status: 'active' })}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Activate
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm(`Delete workflow "${workflow.name}"?`)) {
                          deleteWorkflow.mutate({ id: workflow.id });
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <WorkflowIcon className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No workflows yet</h3>
              <p className="text-muted-foreground mb-6 text-center max-w-md">
                Create your first workflow to start automating your business processes
              </p>
              <Button onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Workflow
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
