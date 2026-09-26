import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/Feedback';
import { SearchX } from 'lucide-react';

export function NotFoundPage() {
  return (
    <EmptyState
      icon={SearchX}
      title="Page not found"
      description="The page you are looking for does not exist or has moved."
      action={<Button to="/dashboard">Go to Dashboard</Button>}
      className="card"
    />
  );
}
