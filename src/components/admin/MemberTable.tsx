import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { useQuery } from "@tanstack/react-query";
import { actions } from "astro:actions";
import { useEffect, useRef, useState } from "react";
import { MemberDetailModal } from "./MemberDetailModal";
import { StatusPill, getMemberCategoryDisplay, getMembershipStatus, getMembershipTypeDisplay } from "./StatusPill";

type MemberFilter = "all" | "yes" | "no";
type MembershipStatusFilter = "all" | "active" | "expired" | "none";
type MembershipTypeFilter = "all" | "senior_player" | "senior_women_player" | "social" | "junior" | "concessionary";
type MemberCategoryFilter = "all" | "senior" | "junior" | "student" | "bursary" | "guest";
type RoleFilter = "all" | "user" | "admin" | "official" | "junior_manager";

const PAGE_SIZE = 20;

export function MemberTable() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [memberFilter, setMemberFilter] = useState<MemberFilter>("all");
  const [statusFilter, setStatusFilter] = useState<MembershipStatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<MembershipTypeFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<MemberCategoryFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [search]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "listUsers", page, PAGE_SIZE, debouncedSearch, includeArchived, memberFilter, statusFilter, typeFilter, categoryFilter, roleFilter],
    queryFn: async () => {
      const result = await actions.admin.listUsers({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        includeArchived,
        isMember: memberFilter,
        membershipStatus: statusFilter,
        membershipType: typeFilter,
        memberCategory: categoryFilter,
        role: roleFilter,
      });
      if (result.error) throw result.error;
      return result.data;
    },
  });

  const result = data;
  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-4">
      {/* Search & filters */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-4">
          <Input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
          <div className="flex items-center gap-2">
            <Checkbox
              id="include-archived"
              checked={includeArchived}
              onCheckedChange={(checked) => {
                setIncludeArchived(checked === true);
                setPage(1);
              }}
            />
            <Label htmlFor="include-archived" className="cursor-pointer text-sm text-gray-600">
              Show archived
            </Label>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={memberFilter} onValueChange={(v) => { setMemberFilter(v as MemberFilter); setPage(1); }}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Member" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Members</SelectItem>
              <SelectItem value="yes">Member</SelectItem>
              <SelectItem value="no">Not Member</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as MembershipStatusFilter); if (v === "none") setTypeFilter("all"); setPage(1); }}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="none">None</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v as MembershipTypeFilter); setPage(1); }} disabled={statusFilter === "none"}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="senior_player">Senior Player</SelectItem>
              <SelectItem value="senior_women_player">Women's Player</SelectItem>
              <SelectItem value="social">Social</SelectItem>
              <SelectItem value="junior">Junior</SelectItem>
              <SelectItem value="concessionary">Student / Concessionary</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v as MemberCategoryFilter); setPage(1); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="senior">Senior</SelectItem>
              <SelectItem value="junior">Junior</SelectItem>
              <SelectItem value="student">Student</SelectItem>
              <SelectItem value="bursary">Bursary</SelectItem>
              <SelectItem value="guest">Guest</SelectItem>
            </SelectContent>
          </Select>
          <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v as RoleFilter); setPage(1); }}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="official">Official</SelectItem>
              <SelectItem value="junior_manager">Junior Manager</SelectItem>
            </SelectContent>
          </Select>
          {(memberFilter !== "all" || statusFilter !== "all" || typeFilter !== "all" || categoryFilter !== "all" || roleFilter !== "all" || includeArchived) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setMemberFilter("all");
                setStatusFilter("all");
                setTypeFilter("all");
                setCategoryFilter("all");
                setRoleFilter("all");
                setIncludeArchived(false);
                setPage(1);
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      {isLoading && <p className="text-gray-500">Loading...</p>}
      {error && <p className="text-red-600">Failed to load users.</p>}

      {result && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Membership Status</TableHead>
                <TableHead>Membership Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.users.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-6 text-center text-gray-500"
                  >
                    No users found.
                  </TableCell>
                </TableRow>
              )}
              {result.users.map((user) => {
                const membershipStatus = getMembershipStatus(user.paidUntil);
                const typeDisplay = getMembershipTypeDisplay(user.membershipType);
                const categoryDisplay = getMemberCategoryDisplay(user.memberCategory);
                return (
                  <TableRow
                    key={user.id}
                    className={`cursor-pointer ${user.isArchived ? "opacity-50" : ""}`}
                    onClick={() => setSelectedUserId(user.id)}
                  >
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      {user.isArchived ? (
                        <StatusPill variant="red">Archived</StatusPill>
                      ) : (
                        <StatusPill
                          variant={user.isMember ? "green" : "red"}
                        >
                          {user.isMember ? "Member" : "Not Member"}
                        </StatusPill>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusPill variant={membershipStatus.variant}>
                        {membershipStatus.label}
                      </StatusPill>
                    </TableCell>
                    <TableCell>
                      <StatusPill variant={typeDisplay.variant}>
                        {typeDisplay.label}
                      </StatusPill>
                    </TableCell>
                    <TableCell>
                      <StatusPill variant={categoryDisplay.variant}>
                        {categoryDisplay.label}
                      </StatusPill>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.role === "admin" && (
                          <StatusPill variant="blue">admin</StatusPill>
                        )}
                        {user.isJuniorManager && (
                          <StatusPill variant="green">
                            Junior Manager
                          </StatusPill>
                        )}
                        {user.isOfficial && (
                          <StatusPill variant="green">Official</StatusPill>
                        )}
                        {user.role !== "admin" &&
                          !user.isJuniorManager &&
                          !user.isOfficial && (
                            <StatusPill variant="gray">user</StatusPill>
                          )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              {result.total} user{result.total !== 1 ? "s" : ""} total
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <span className="text-gray-600">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Detail Modal */}
      {selectedUserId && (
        <MemberDetailModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </div>
  );
}
