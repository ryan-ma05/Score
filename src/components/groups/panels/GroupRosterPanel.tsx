import type { Friend } from '../../../context/FriendContext'
import type { Group, GroupMember } from '../../../context/GroupContext'
import { inputClassName } from '../groupDetailUtils'
import { EmptyState, Panel } from './shared'

interface Props {
  group: Group
  members: GroupMember[]
  isOwner: boolean
  currentUserId: number
  invitableFriends: Friend[]
  nonOwnerMembers: GroupMember[]
  transferTarget: number | null
  onCopyCode: () => void
  onRemove: (memberId: number) => void
  onInvite: (friendId: number) => void
  onSetTransferTarget: (id: number | null) => void
  onTransfer: () => void
  onLeave: () => void
}

export default function GroupRosterPanel({
  group,
  members,
  isOwner,
  currentUserId,
  invitableFriends,
  nonOwnerMembers,
  transferTarget,
  onCopyCode,
  onRemove,
  onInvite,
  onSetTransferTarget,
  onTransfer,
  onLeave,
}: Props) {
  return (
    <div className="space-y-5">
      <Panel
        title="Group roster"
        subtitle={
          isOwner
            ? 'See who is in the group and use the owner controls below to manage member access.'
            : 'See who is in the group and follow the shared sessions and templates.'
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {members.map((member) => (
            <div key={member.id} className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {member.name}
                    {member.id === group.owner_id && (
                      <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                        Owner
                      </span>
                    )}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-400">{member.email}</p>
                </div>
                {isOwner && member.id !== currentUserId && (
                  <button
                    onClick={() => onRemove(member.id)}
                    className="shrink-0 rounded-full border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {isOwner && (
        <Panel
          title="Add members"
          subtitle="Invite friends directly or share the join code so new people can get into the group."
        >
          <div className="space-y-4">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50/85 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Join code</p>
                  <p className="mt-2 font-mono text-lg font-semibold tracking-[0.18em] text-slate-900">
                    {group.join_code}
                  </p>
                </div>
                <button
                  onClick={onCopyCode}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Copy code
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {invitableFriends.length === 0 ? (
                <EmptyState message="All of your friends are already in this group, or you do not have any friends available to invite yet." />
              ) : (
                invitableFriends.map((friend) => (
                  <div key={friend.id} className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{friend.name}</p>
                        <p className="mt-1 truncate text-xs text-slate-400">{friend.email}</p>
                      </div>
                      <button
                        onClick={() => onInvite(friend.id)}
                        className="shrink-0 rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-700"
                      >
                        Invite
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Panel>
      )}

      {isOwner && nonOwnerMembers.length > 0 && (
        <Panel
          title="Ownership"
          subtitle="Hand the group off cleanly before leaving or changing who manages it."
        >
          <div className="rounded-[24px] border border-amber-100 bg-amber-50/80 p-4">
            <div className="flex flex-col gap-3">
              <select
                value={transferTarget ?? ''}
                onChange={(event) => onSetTransferTarget(Number(event.target.value) || null)}
                className={inputClassName}
              >
                <option value="">Pick a member…</option>
                {nonOwnerMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
              <button
                onClick={onTransfer}
                disabled={!transferTarget}
                className="rounded-full bg-amber-500 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Transfer ownership
              </button>
            </div>
          </div>
        </Panel>
      )}

      {!isOwner && (
        <Panel title="Membership" subtitle="You can leave the group here whenever you no longer need access.">
          <div className="rounded-[24px] border border-rose-100 bg-rose-50/80 p-4">
            <button
              onClick={onLeave}
              className="rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50"
            >
              Leave group
            </button>
          </div>
        </Panel>
      )}
    </div>
  )
}
