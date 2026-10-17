import app from './app';
import { budgetsService } from './modules/budgets/budgets.service';

const port = Number(process.env.PORT ?? 4000);

app.listen(port, () => {
  console.log(`SalesPilotAI API listening on http://localhost:${port}`);
  void budgetsService.processDueFollowUps().catch((error) => {
    console.error('Could not process scheduled budget follow-ups:', error);
  });
  setInterval(() => {
    void budgetsService.processDueFollowUps().catch((error) => {
      console.error('Could not process scheduled budget follow-ups:', error);
    });
  }, 60 * 60 * 1000);
});
