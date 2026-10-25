<script lang="ts">
  import { partnerTimeline } from '$lib/custom/partner-timeline.svelte';
  import { Button, IconButton } from '@immich/ui';
  import { mdiAccountMultiple, mdiAccountMultipleRemoveOutline } from '@mdi/js';
  import { onMount } from 'svelte';
  import { t } from 'svelte-i18n';

  // Custom patch, not part of upstream Immich (see FORK.md): partner switch in the navigation bar, shown like
  // the upload button: with the partner's name on wide screens, as an icon on narrow ones.

  const names = $derived(partnerTimeline.partners.map(({ name }) => name).join(', '));
  const icon = $derived(partnerTimeline.isEnabled ? mdiAccountMultiple : mdiAccountMultipleRemoveOutline);
  const color = $derived(partnerTimeline.isEnabled ? 'primary' : 'secondary');
  const title = $derived(`${names}: ${$t('show_in_timeline')}`);

  onMount(() => void partnerTimeline.load());
</script>

{#if partnerTimeline.partners.length > 0}
  <Button
    leadingIcon={icon}
    onclick={() => void partnerTimeline.toggle()}
    disabled={partnerTimeline.isUpdating}
    class={partnerTimeline.isEnabled ? 'hidden lg:flex' : 'hidden line-through lg:flex'}
    variant="ghost"
    size="medium"
    {color}
    {title}
    aria-pressed={partnerTimeline.isEnabled}
    >{names}
  </Button>
  <IconButton
    shape="round"
    variant="ghost"
    size="medium"
    {color}
    {icon}
    onclick={() => void partnerTimeline.toggle()}
    disabled={partnerTimeline.isUpdating}
    {title}
    aria-label={title}
    aria-pressed={partnerTimeline.isEnabled}
    class="lg:hidden"
  />
{/if}
