<script lang="ts">
    import Button from '../../lib/Button.svelte';
    import BottomSheet from '../../lib/BottomSheet.svelte';
    import TrashSimpleIcon from 'phosphor-svelte/lib/TrashSimpleIcon';
    import type EpisodeData from '../../types/Episode';

    let {
        isOpen = $bindable(),
        episode,
        onConfirm,
        onCancel,
    }: {
        isOpen: boolean;
        episode: EpisodeData | null;
        onConfirm: () => void;
        onCancel: () => void;
    } = $props();
</script>

<BottomSheet bind:isOpen ariaLabel="Confirm Delete Download">
    <div class="confirm-delete-sheet">
        <h3 class="sheet-title">Delete offline download?</h3>
        <p class="sheet-desc">
            You are currently <strong>offline</strong>. If you delete
            <strong>Episode {episode?.number}</strong>, you will not be able to re-download or
            watch it until you reconnect to the internet.
        </p>
        <div class="sheet-actions">
            <Button style="ghost" onclick={onCancel}>Cancel</Button>
            <Button class="btn-danger" Icon={TrashSimpleIcon} onclick={onConfirm}>
                Delete Episode
            </Button>
        </div>
    </div>
</BottomSheet>

<style lang="scss">
    .confirm-delete-sheet {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 8px 4px;

        .sheet-title {
            margin: 0;
            font-size: 18px;
            font-weight: 700;
            color: #ffffff;
        }

        .sheet-desc {
            margin: 0;
            font-size: 14px;
            line-height: 1.5;
            color: #b0aba4;

            strong {
                color: #ffffff;
            }
        }

        .sheet-actions {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 8px;

            :global(button.btn-danger) {
                background: #dc2626 !important;
                border-color: #ef4444 !important;
                color: #ffffff !important;

                &:hover {
                    background: #b91c1c !important;
                }
            }
        }
    }
</style>
