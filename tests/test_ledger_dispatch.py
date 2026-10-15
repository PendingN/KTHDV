import unittest
from unittest.mock import AsyncMock, MagicMock, call, patch

from python.ledger import main as ledger


class DispatchTests(unittest.IsolatedAsyncioTestCase):
    async def dispatch_events(self, events, error=None):
        database = MagicMock()
        with (
            patch.object(ledger, "database", return_value=database),
            patch.object(ledger, "rows", return_value=events),
            patch.object(ledger, "peer", new_callable=AsyncMock, side_effect=error) as peer,
            patch.object(ledger, "execute") as execute,
            patch.object(ledger, "many") as many,
        ):
            result = await ledger.dispatch(None)
        return result, peer, execute, many

    async def test_evaluates_once_per_user_and_marks_only_selected_events(self):
        events = [{"id": 1, "user_id": 7}, {"id": 2, "user_id": 8}, {"id": 3, "user_id": 7}]
        result, peer, _, many = await self.dispatch_events(events)
        self.assertEqual(result, {"processed": 3})
        self.assertEqual(peer.await_args_list, [
            call("planning", "POST", "/internal/evaluate/7"),
            call("planning", "POST", "/internal/evaluate/8"),
        ])
        self.assertEqual([args.args[2] for args in many.call_args_list], [[(1,), (3,)], [(2,)]])
        self.assertTrue(all("sent=1" in args.args[1] for args in many.call_args_list))

    async def test_failure_keeps_events_pending_and_other_users_continue(self):
        events = [{"id": 1, "user_id": 7}, {"id": 2, "user_id": 7}, {"id": 3, "user_id": 8}]
        result, peer, _, many = await self.dispatch_events(events, [RuntimeError("offline"), None])
        self.assertEqual(result, {"processed": 3})
        self.assertEqual(peer.await_count, 2)
        self.assertNotIn("sent=1", many.call_args_list[0].args[1])
        self.assertEqual(many.call_args_list[0].args[2], [("offline", 1), ("offline", 2)])
        self.assertIn("sent=1", many.call_args_list[1].args[1])
        self.assertEqual(many.call_args_list[1].args[2], [(3,)])

    async def test_error_is_bounded_to_database_column(self):
        _, _, _, many = await self.dispatch_events([{"id": 1, "user_id": 7}], RuntimeError("x" * 500))
        self.assertEqual(many.call_args.args[2], [("x" * 300, 1)])

    async def test_empty_batch_makes_no_calls_or_updates(self):
        result, peer, execute, many = await self.dispatch_events([])
        self.assertEqual(result, {"processed": 0})
        peer.assert_not_awaited()
        execute.assert_not_called()
        many.assert_not_called()
