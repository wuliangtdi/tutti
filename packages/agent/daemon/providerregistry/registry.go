package providerregistry

import (
	"fmt"
	"strings"
)

// Migrated returns the descriptors that have completed the provider-registry
// migration. Providers not present here continue through the explicitly
// temporary legacy registrations in their owning layers.
func Migrated() []ProviderDescriptor {
	descriptors := []ProviderDescriptor{codexDescriptor()}
	result := make([]ProviderDescriptor, 0, len(descriptors))
	for _, descriptor := range descriptors {
		result = append(result, cloneDescriptor(descriptor))
	}
	return result
}

func Find(value string) (ProviderDescriptor, bool) {
	normalized := normalize(value)
	if normalized == "" {
		return ProviderDescriptor{}, false
	}
	for _, descriptor := range Migrated() {
		if normalize(descriptor.Identity.ID) == normalized {
			return descriptor, true
		}
		for _, alias := range descriptor.Identity.Aliases {
			if normalize(alias) == normalized {
				return descriptor, true
			}
		}
	}
	return ProviderDescriptor{}, false
}

func FindEventProvider(value string) (ProviderDescriptor, bool) {
	normalized := normalize(value)
	if normalized == "" {
		return ProviderDescriptor{}, false
	}
	for _, descriptor := range Migrated() {
		if !descriptor.Events.Enabled {
			continue
		}
		if normalize(descriptor.Identity.ID) == normalized {
			return descriptor, true
		}
		for _, alias := range descriptor.Events.Aliases {
			if normalize(alias) == normalized {
				return descriptor, true
			}
		}
	}
	return ProviderDescriptor{}, false
}

func ValidateMigrated() error {
	providerKeys := map[string]string{}
	targetIDs := map[string]string{}
	for _, descriptor := range Migrated() {
		if err := Validate(descriptor); err != nil {
			return err
		}
		providerID := normalize(descriptor.Identity.ID)
		for _, key := range append([]string{providerID}, descriptor.Identity.Aliases...) {
			normalizedKey := normalize(key)
			if owner, exists := providerKeys[normalizedKey]; exists {
				return fmt.Errorf("provider key %q is shared by %q and %q", normalizedKey, owner, providerID)
			}
			providerKeys[normalizedKey] = providerID
		}
		targetID := strings.TrimSpace(descriptor.Target.ID)
		if owner, exists := targetIDs[targetID]; exists {
			return fmt.Errorf("target id %q is shared by %q and %q", targetID, owner, providerID)
		}
		targetIDs[targetID] = providerID
	}
	return nil
}

func Validate(descriptor ProviderDescriptor) error {
	providerID := normalize(descriptor.Identity.ID)
	if providerID == "" {
		return fmt.Errorf("provider identity id is required")
	}
	if strings.TrimSpace(descriptor.Identity.DisplayName) == "" {
		return fmt.Errorf("provider %q display name is required", providerID)
	}
	if strings.TrimSpace(descriptor.Identity.IconKey) == "" {
		return fmt.Errorf("provider %q icon key is required", providerID)
	}
	if strings.TrimSpace(descriptor.Identity.LocaleKey) == "" {
		return fmt.Errorf("provider %q locale key is required", providerID)
	}
	if descriptor.Runtime.Kind == "" {
		return fmt.Errorf("provider %q runtime kind is required", providerID)
	}
	if len(descriptor.Runtime.Command) == 0 {
		return fmt.Errorf("provider %q runtime command is required", providerID)
	}
	if descriptor.Status.Install.Kind == "" {
		return fmt.Errorf("provider %q installer kind is required", providerID)
	}
	if descriptor.Status.Kind == "" {
		return fmt.Errorf("provider %q status kind is required", providerID)
	}
	if strings.TrimSpace(descriptor.Target.ID) == "" {
		return fmt.Errorf("provider %q target id is required", providerID)
	}
	if descriptor.Target.SortOrder < 0 {
		return fmt.Errorf("provider %q target sort order must be non-negative", providerID)
	}
	if !descriptor.Events.Enabled {
		return fmt.Errorf("provider %q event normalization must be enabled", providerID)
	}
	if descriptor.ComposerProfile.PermissionConfigurable && len(descriptor.ComposerProfile.PermissionModes) == 0 {
		return fmt.Errorf("provider %q configurable permissions require modes", providerID)
	}
	if descriptor.ComposerProfile.ModelSelection && strings.TrimSpace(descriptor.ComposerProfile.ConfigOptionIDs.Model) == "" {
		return fmt.Errorf("provider %q model selection requires a config option id", providerID)
	}
	if descriptor.ComposerProfile.ReasoningEffort && strings.TrimSpace(descriptor.ComposerProfile.ConfigOptionIDs.Reasoning) == "" {
		return fmt.Errorf("provider %q reasoning requires a config option id", providerID)
	}
	if descriptor.ComposerProfile.Speed && strings.TrimSpace(descriptor.ComposerProfile.ConfigOptionIDs.Speed) == "" {
		return fmt.Errorf("provider %q speed requires a config option id", providerID)
	}
	defaultPermissionModeID := strings.TrimSpace(descriptor.ComposerProfile.DefaultPermissionModeID)
	if defaultPermissionModeID != "" {
		for _, mode := range descriptor.ComposerProfile.PermissionModes {
			if strings.TrimSpace(mode.ID) == defaultPermissionModeID {
				return nil
			}
		}
		return fmt.Errorf("provider %q default permission mode %q is not declared", providerID, defaultPermissionModeID)
	}
	return nil
}

func normalize(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func cloneDescriptor(value ProviderDescriptor) ProviderDescriptor {
	value.Identity.Aliases = append([]string(nil), value.Identity.Aliases...)
	value.Runtime.Command = append([]string(nil), value.Runtime.Command...)
	value.Status.BinaryNames = append([]string(nil), value.Status.BinaryNames...)
	value.Status.AdapterBinaryNames = append([]string(nil), value.Status.AdapterBinaryNames...)
	value.Status.AuthStatusCommand = append([]string(nil), value.Status.AuthStatusCommand...)
	value.Status.AuthMarkerPaths = append([]string(nil), value.Status.AuthMarkerPaths...)
	value.Status.APIEndpoints = append([]string(nil), value.Status.APIEndpoints...)
	value.Status.CustomConfigEnvVars = append([]string(nil), value.Status.CustomConfigEnvVars...)
	value.Status.CredentialEnvVars = append([]string(nil), value.Status.CredentialEnvVars...)
	value.Status.LoginArgs = append([]string(nil), value.Status.LoginArgs...)
	value.ComposerProfile.ReasoningEffortValues = append([]string(nil), value.ComposerProfile.ReasoningEffortValues...)
	value.ComposerProfile.Capabilities = append([]string(nil), value.ComposerProfile.Capabilities...)
	value.ComposerProfile.PermissionModes = append([]PermissionModeDescriptor(nil), value.ComposerProfile.PermissionModes...)
	value.Events.Aliases = append([]string(nil), value.Events.Aliases...)
	return value
}
