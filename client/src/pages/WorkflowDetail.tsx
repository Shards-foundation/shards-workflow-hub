import DashboardLayout from "@/components/DashboardLayout";
import { useRoute } from "wouter";

export default function WorkflowDetail() {
  const [, params] = useRoute("/workflows/:id");
  
  return (
    <DashboardLayout>
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">Workflow Detail: {params?.id}</h1>
        <p className="text-muted-foreground">Workflow detail content coming soon</p>
      </div>
    </DashboardLayout>
  );
}
