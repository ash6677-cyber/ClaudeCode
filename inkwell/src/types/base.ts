export interface BaseEntity {
  id: string
  createdAt: number
  updatedAt: number
  /**
   * When this record went into the bin, or null/absent if it is live.
   *
   * Optional so that every record written before the bin existed — and every
   * object literal in the codebase — remains a valid entity: absent reads as
   * "not deleted", which is what those records are.
   */
  deletedAt?: number | null
  /**
   * The record whose deletion took this one with it, if any.
   *
   * Deleting a chapter bins its scenes too. Without knowing which deletion
   * swept them up, the bin would list a chapter and forty loose scenes as
   * forty-one separate things to restore, and restoring the chapter alone
   * would bring back an empty one.
   */
  deletedWith?: string | null
}
