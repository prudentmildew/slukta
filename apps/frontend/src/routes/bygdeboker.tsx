import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/bygdeboker')({
  component: Bygdeboker,
});

function Bygdeboker() {
  return (
    <div>
      <h1>Bygdebøker</h1>
    </div>
  );
}
