export interface KanbanProcess {
  id: string;
  number: string;
  title: string;
  client_name: string;
  type: string;
  status: string;
  fase: string | null;
  risk_level: string;
  responsible_id: string | null;
  kanban_position: number;
  created_at: string;
}

export interface OrgMemberOption {
  user_id: string;
  full_name: string;
}

export interface DeadlineStats {
  pending: number;
  overdue: number;
}
