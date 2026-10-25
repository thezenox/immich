import { getPartners, PartnerDirection, updatePartner, type PartnerResponseDto } from '@immich/sdk';

// Custom patch, not part of upstream Immich (see FORK.md): quick switch for the partner assets in the main
// timeline, the same setting as "Show in timeline" in the partner sharing settings.
class PartnerTimeline {
  partners = $state<PartnerResponseDto[]>([]);
  isEnabled = $derived(this.partners.some(({ inTimeline }) => inTimeline));
  isUpdating = $state(false);
  /** Changes after every switch, the photos page reloads its timeline on it. */
  version = $state(0);

  async load() {
    this.partners = await getPartners({ direction: PartnerDirection.SharedWith });
  }

  async toggle() {
    if (this.isUpdating) {
      return;
    }

    const inTimeline = !this.isEnabled;
    this.isUpdating = true;
    try {
      this.partners = await Promise.all(
        this.partners.map(({ id }) => updatePartner({ id, partnerUpdateDto: { inTimeline } })),
      );
      this.version++;
    } finally {
      this.isUpdating = false;
    }
  }
}

export const partnerTimeline = new PartnerTimeline();
