import PageHeader from "@/components/PageHeader";
import OperationTaskList from "@/components/OperationTaskList";
import { useAppStore } from "@/store/useAppStore";

export default function ProductionPage() {
  const { tasks } = useAppStore();
  const prodTasks = tasks.filter(t => t.module === "Produção" || t.sector === "Produção");

  return (
    <div>
      <PageHeader title="Produção" description="Roteiros, gravações, edições e design" />
      <OperationTaskList moduleName="Produção" tasks={prodTasks} />
    </div>
  );
}