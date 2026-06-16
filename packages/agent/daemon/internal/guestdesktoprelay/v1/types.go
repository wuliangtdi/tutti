//revive:disable:file-length-limit
package guestdesktoprelayv1

import "google.golang.org/protobuf/types/known/structpb"

type AgentSessionOrigin int32

const (
	AgentSessionOrigin_AGENT_SESSION_ORIGIN_UNSPECIFIED AgentSessionOrigin = 0
	AgentSessionOrigin_AGENT_SESSION_ORIGIN_RUNTIME     AgentSessionOrigin = 2
)

type UnimplementedAgentActivityIngressServiceServer struct{}
type UnimplementedAgentContextServiceServer struct{}

func RegisterAgentActivityIngressServiceServer(any, any) {}
func RegisterAgentContextServiceServer(any, any)         {}

type AgentActivityConnector struct {
	Id      string
	Version string
}

func (x *AgentActivityConnector) GetId() string {
	if x == nil {
		return ""
	}
	return x.Id
}

func (x *AgentActivityConnector) GetVersion() string {
	if x == nil {
		return ""
	}
	return x.Version
}

type AgentActivitySource struct {
	Provider          string
	ProviderSessionId string
	AgentId           string
	Cwd               string
	SessionOrigin     AgentSessionOrigin
}

func (x *AgentActivitySource) GetProvider() string {
	if x == nil {
		return ""
	}
	return x.Provider
}

func (x *AgentActivitySource) GetProviderSessionId() string {
	if x == nil {
		return ""
	}
	return x.ProviderSessionId
}

func (x *AgentActivitySource) GetAgentId() string {
	if x == nil {
		return ""
	}
	return x.AgentId
}

func (x *AgentActivitySource) GetCwd() string {
	if x == nil {
		return ""
	}
	return x.Cwd
}

func (x *AgentActivitySource) GetSessionOrigin() AgentSessionOrigin {
	if x == nil {
		return AgentSessionOrigin_AGENT_SESSION_ORIGIN_UNSPECIFIED
	}
	return x.SessionOrigin
}

type ReportAgentActivityRequest struct {
	WorkspaceId    string
	Connector      *AgentActivityConnector
	Source         *AgentActivitySource
	TimelineItems  []*AgentActivityTimelineItem
	StatePatches   []*AgentActivityStatePatch
	MessageUpdates []*AgentActivityMessageUpdate
}

func (x *ReportAgentActivityRequest) GetWorkspaceId() string {
	if x == nil {
		return ""
	}
	return x.WorkspaceId
}

func (x *ReportAgentActivityRequest) GetConnector() *AgentActivityConnector {
	if x == nil {
		return nil
	}
	return x.Connector
}

func (x *ReportAgentActivityRequest) GetSource() *AgentActivitySource {
	if x == nil {
		return nil
	}
	return x.Source
}

func (x *ReportAgentActivityRequest) GetTimelineItems() []*AgentActivityTimelineItem {
	if x == nil {
		return nil
	}
	return x.TimelineItems
}

func (x *ReportAgentActivityRequest) GetStatePatches() []*AgentActivityStatePatch {
	if x == nil {
		return nil
	}
	return x.StatePatches
}

func (x *ReportAgentActivityRequest) GetMessageUpdates() []*AgentActivityMessageUpdate {
	if x == nil {
		return nil
	}
	return x.MessageUpdates
}

type ReportAgentActivityResponse struct {
	AcceptedTimelineItemCount  int32
	AcceptedStatePatchCount    int32
	AcceptedMessageUpdateCount int32
}

func (x *ReportAgentActivityResponse) GetAcceptedTimelineItemCount() int32 {
	if x == nil {
		return 0
	}
	return x.AcceptedTimelineItemCount
}

func (x *ReportAgentActivityResponse) GetAcceptedStatePatchCount() int32 {
	if x == nil {
		return 0
	}
	return x.AcceptedStatePatchCount
}

func (x *ReportAgentActivityResponse) GetAcceptedMessageUpdateCount() int32 {
	if x == nil {
		return 0
	}
	return x.AcceptedMessageUpdateCount
}

type ReportAgentSessionStateRequest struct {
	WorkspaceId    string
	AgentSessionId string
	SessionOrigin  AgentSessionOrigin
	Connector      *AgentActivityConnector
	Source         *AgentActivitySource
	State          *AgentSessionStateUpdate
}

func (x *ReportAgentSessionStateRequest) GetWorkspaceId() string {
	if x == nil {
		return ""
	}
	return x.WorkspaceId
}

func (x *ReportAgentSessionStateRequest) GetAgentSessionId() string {
	if x == nil {
		return ""
	}
	return x.AgentSessionId
}

func (x *ReportAgentSessionStateRequest) GetSessionOrigin() AgentSessionOrigin {
	if x == nil {
		return AgentSessionOrigin_AGENT_SESSION_ORIGIN_UNSPECIFIED
	}
	return x.SessionOrigin
}

func (x *ReportAgentSessionStateRequest) GetConnector() *AgentActivityConnector {
	if x == nil {
		return nil
	}
	return x.Connector
}

func (x *ReportAgentSessionStateRequest) GetSource() *AgentActivitySource {
	if x == nil {
		return nil
	}
	return x.Source
}

func (x *ReportAgentSessionStateRequest) GetState() *AgentSessionStateUpdate {
	if x == nil {
		return nil
	}
	return x.State
}

type ReportAgentSessionStateResponse struct {
	Accepted          bool
	LastEventAtUnixMs int64
}

func (x *ReportAgentSessionStateResponse) GetAccepted() bool {
	return x != nil && x.Accepted
}

func (x *ReportAgentSessionStateResponse) GetLastEventAtUnixMs() int64 {
	if x == nil {
		return 0
	}
	return x.LastEventAtUnixMs
}

type ReportAgentSessionMessagesRequest struct {
	WorkspaceId    string
	AgentSessionId string
	SessionOrigin  AgentSessionOrigin
	Connector      *AgentActivityConnector
	Source         *AgentActivitySource
	Updates        []*AgentSessionMessageUpdate
}

func (x *ReportAgentSessionMessagesRequest) GetWorkspaceId() string {
	if x == nil {
		return ""
	}
	return x.WorkspaceId
}

func (x *ReportAgentSessionMessagesRequest) GetAgentSessionId() string {
	if x == nil {
		return ""
	}
	return x.AgentSessionId
}

func (x *ReportAgentSessionMessagesRequest) GetSessionOrigin() AgentSessionOrigin {
	if x == nil {
		return AgentSessionOrigin_AGENT_SESSION_ORIGIN_UNSPECIFIED
	}
	return x.SessionOrigin
}

func (x *ReportAgentSessionMessagesRequest) GetConnector() *AgentActivityConnector {
	if x == nil {
		return nil
	}
	return x.Connector
}

func (x *ReportAgentSessionMessagesRequest) GetSource() *AgentActivitySource {
	if x == nil {
		return nil
	}
	return x.Source
}

func (x *ReportAgentSessionMessagesRequest) GetUpdates() []*AgentSessionMessageUpdate {
	if x == nil {
		return nil
	}
	return x.Updates
}

type ReportAgentSessionMessagesResponse struct {
	AcceptedCount int32
	LatestVersion uint64
}

func (x *ReportAgentSessionMessagesResponse) GetAcceptedCount() int32 {
	if x == nil {
		return 0
	}
	return x.AcceptedCount
}

func (x *ReportAgentSessionMessagesResponse) GetLatestVersion() uint64 {
	if x == nil {
		return 0
	}
	return x.LatestVersion
}

type AgentActivityTimelineItem struct {
	Id               uint64
	RoomId           string
	AgentSessionId   string
	TurnId           string
	EventId          string
	ActorType        string
	ActorId          string
	ItemType         string
	Role             string
	CallType         string
	CallId           string
	Name             string
	Status           string
	Payload          *structpb.Struct
	OccurredAtUnixMs int64
	CreatedAtUnixMs  int64
	EventSource      string
}

func (x *AgentActivityTimelineItem) GetId() uint64 {
	if x == nil {
		return 0
	}
	return x.Id
}
func (x *AgentActivityTimelineItem) GetRoomId() string {
	if x == nil {
		return ""
	}
	return x.RoomId
}
func (x *AgentActivityTimelineItem) GetAgentSessionId() string {
	if x == nil {
		return ""
	}
	return x.AgentSessionId
}
func (x *AgentActivityTimelineItem) GetTurnId() string {
	if x == nil {
		return ""
	}
	return x.TurnId
}
func (x *AgentActivityTimelineItem) GetEventId() string {
	if x == nil {
		return ""
	}
	return x.EventId
}
func (x *AgentActivityTimelineItem) GetActorType() string {
	if x == nil {
		return ""
	}
	return x.ActorType
}
func (x *AgentActivityTimelineItem) GetActorId() string {
	if x == nil {
		return ""
	}
	return x.ActorId
}
func (x *AgentActivityTimelineItem) GetItemType() string {
	if x == nil {
		return ""
	}
	return x.ItemType
}
func (x *AgentActivityTimelineItem) GetRole() string {
	if x == nil {
		return ""
	}
	return x.Role
}
func (x *AgentActivityTimelineItem) GetCallType() string {
	if x == nil {
		return ""
	}
	return x.CallType
}
func (x *AgentActivityTimelineItem) GetCallId() string {
	if x == nil {
		return ""
	}
	return x.CallId
}
func (x *AgentActivityTimelineItem) GetName() string {
	if x == nil {
		return ""
	}
	return x.Name
}
func (x *AgentActivityTimelineItem) GetStatus() string {
	if x == nil {
		return ""
	}
	return x.Status
}
func (x *AgentActivityTimelineItem) GetPayload() *structpb.Struct {
	if x == nil {
		return nil
	}
	return x.Payload
}
func (x *AgentActivityTimelineItem) GetOccurredAtUnixMs() int64 {
	if x == nil {
		return 0
	}
	return x.OccurredAtUnixMs
}
func (x *AgentActivityTimelineItem) GetCreatedAtUnixMs() int64 {
	if x == nil {
		return 0
	}
	return x.CreatedAtUnixMs
}
func (x *AgentActivityTimelineItem) GetEventSource() string {
	if x == nil {
		return ""
	}
	return x.EventSource
}

type AgentActivityTurnPatch struct {
	TurnId            string
	Phase             string
	Outcome           string
	FileChanges       *structpb.Struct
	StartedAtUnixMs   int64
	CompletedAtUnixMs int64
}

func (x *AgentActivityTurnPatch) GetTurnId() string {
	if x == nil {
		return ""
	}
	return x.TurnId
}
func (x *AgentActivityTurnPatch) GetPhase() string {
	if x == nil {
		return ""
	}
	return x.Phase
}
func (x *AgentActivityTurnPatch) GetOutcome() string {
	if x == nil {
		return ""
	}
	return x.Outcome
}
func (x *AgentActivityTurnPatch) GetFileChanges() *structpb.Struct {
	if x == nil {
		return nil
	}
	return x.FileChanges
}
func (x *AgentActivityTurnPatch) GetStartedAtUnixMs() int64 {
	if x == nil {
		return 0
	}
	return x.StartedAtUnixMs
}
func (x *AgentActivityTurnPatch) GetCompletedAtUnixMs() int64 {
	if x == nil {
		return 0
	}
	return x.CompletedAtUnixMs
}

type AgentActivityEntityPatch struct {
	CallId            string
	TurnId            string
	CallType          string
	Name              string
	Status            string
	Input             *structpb.Struct
	Output            *structpb.Struct
	Error             *structpb.Struct
	StartedAtUnixMs   int64
	CompletedAtUnixMs int64
}

func (x *AgentActivityEntityPatch) GetCallId() string {
	if x == nil {
		return ""
	}
	return x.CallId
}
func (x *AgentActivityEntityPatch) GetTurnId() string {
	if x == nil {
		return ""
	}
	return x.TurnId
}
func (x *AgentActivityEntityPatch) GetCallType() string {
	if x == nil {
		return ""
	}
	return x.CallType
}
func (x *AgentActivityEntityPatch) GetName() string {
	if x == nil {
		return ""
	}
	return x.Name
}
func (x *AgentActivityEntityPatch) GetStatus() string {
	if x == nil {
		return ""
	}
	return x.Status
}
func (x *AgentActivityEntityPatch) GetInput() *structpb.Struct {
	if x == nil {
		return nil
	}
	return x.Input
}
func (x *AgentActivityEntityPatch) GetOutput() *structpb.Struct {
	if x == nil {
		return nil
	}
	return x.Output
}
func (x *AgentActivityEntityPatch) GetError() *structpb.Struct {
	if x == nil {
		return nil
	}
	return x.Error
}
func (x *AgentActivityEntityPatch) GetStartedAtUnixMs() int64 {
	if x == nil {
		return 0
	}
	return x.StartedAtUnixMs
}
func (x *AgentActivityEntityPatch) GetCompletedAtUnixMs() int64 {
	if x == nil {
		return 0
	}
	return x.CompletedAtUnixMs
}

type AgentActivityStatePatch struct {
	AgentSessionId    string
	Provider          string
	ProviderSessionId string
	Model             string
	Cwd               string
	Title             string
	LifecycleStatus   string
	CurrentPhase      string
	OccurredAtUnixMs  int64
	Turn              *AgentActivityTurnPatch
	Entities          []*AgentActivityEntityPatch
}

func (x *AgentActivityStatePatch) GetAgentSessionId() string {
	if x == nil {
		return ""
	}
	return x.AgentSessionId
}
func (x *AgentActivityStatePatch) GetProvider() string {
	if x == nil {
		return ""
	}
	return x.Provider
}
func (x *AgentActivityStatePatch) GetProviderSessionId() string {
	if x == nil {
		return ""
	}
	return x.ProviderSessionId
}
func (x *AgentActivityStatePatch) GetModel() string {
	if x == nil {
		return ""
	}
	return x.Model
}
func (x *AgentActivityStatePatch) GetCwd() string {
	if x == nil {
		return ""
	}
	return x.Cwd
}
func (x *AgentActivityStatePatch) GetTitle() string {
	if x == nil {
		return ""
	}
	return x.Title
}
func (x *AgentActivityStatePatch) GetLifecycleStatus() string {
	if x == nil {
		return ""
	}
	return x.LifecycleStatus
}
func (x *AgentActivityStatePatch) GetCurrentPhase() string {
	if x == nil {
		return ""
	}
	return x.CurrentPhase
}
func (x *AgentActivityStatePatch) GetOccurredAtUnixMs() int64 {
	if x == nil {
		return 0
	}
	return x.OccurredAtUnixMs
}
func (x *AgentActivityStatePatch) GetTurn() *AgentActivityTurnPatch {
	if x == nil {
		return nil
	}
	return x.Turn
}
func (x *AgentActivityStatePatch) GetEntities() []*AgentActivityEntityPatch {
	if x == nil {
		return nil
	}
	return x.Entities
}

type AgentActivityMessageUpdate struct {
	AgentSessionId    string
	MessageId         string
	Seq               uint64
	TurnId            string
	Role              string
	Kind              string
	Status            string
	CallId            string
	ParentCallId      string
	RootCallId        string
	Title             string
	Payload           *structpb.Struct
	OccurredAtUnixMs  int64
	StartedAtUnixMs   int64
	CompletedAtUnixMs int64
}

func (x *AgentActivityMessageUpdate) GetAgentSessionId() string {
	if x == nil {
		return ""
	}
	return x.AgentSessionId
}
func (x *AgentActivityMessageUpdate) GetMessageId() string {
	if x == nil {
		return ""
	}
	return x.MessageId
}
func (x *AgentActivityMessageUpdate) GetSeq() uint64 {
	if x == nil {
		return 0
	}
	return x.Seq
}
func (x *AgentActivityMessageUpdate) GetTurnId() string {
	if x == nil {
		return ""
	}
	return x.TurnId
}
func (x *AgentActivityMessageUpdate) GetRole() string {
	if x == nil {
		return ""
	}
	return x.Role
}
func (x *AgentActivityMessageUpdate) GetKind() string {
	if x == nil {
		return ""
	}
	return x.Kind
}
func (x *AgentActivityMessageUpdate) GetStatus() string {
	if x == nil {
		return ""
	}
	return x.Status
}
func (x *AgentActivityMessageUpdate) GetCallId() string {
	if x == nil {
		return ""
	}
	return x.CallId
}
func (x *AgentActivityMessageUpdate) GetParentCallId() string {
	if x == nil {
		return ""
	}
	return x.ParentCallId
}
func (x *AgentActivityMessageUpdate) GetRootCallId() string {
	if x == nil {
		return ""
	}
	return x.RootCallId
}
func (x *AgentActivityMessageUpdate) GetTitle() string {
	if x == nil {
		return ""
	}
	return x.Title
}
func (x *AgentActivityMessageUpdate) GetPayload() *structpb.Struct {
	if x == nil {
		return nil
	}
	return x.Payload
}
func (x *AgentActivityMessageUpdate) GetOccurredAtUnixMs() int64 {
	if x == nil {
		return 0
	}
	return x.OccurredAtUnixMs
}
func (x *AgentActivityMessageUpdate) GetStartedAtUnixMs() int64 {
	if x == nil {
		return 0
	}
	return x.StartedAtUnixMs
}
func (x *AgentActivityMessageUpdate) GetCompletedAtUnixMs() int64 {
	if x == nil {
		return 0
	}
	return x.CompletedAtUnixMs
}

type AgentSessionTurnStateUpdate struct {
	TurnId            string
	Phase             string
	Outcome           string
	FileChanges       *structpb.Struct
	StartedAtUnixMs   int64
	CompletedAtUnixMs int64
}

func (x *AgentSessionTurnStateUpdate) GetTurnId() string {
	if x == nil {
		return ""
	}
	return x.TurnId
}
func (x *AgentSessionTurnStateUpdate) GetPhase() string {
	if x == nil {
		return ""
	}
	return x.Phase
}
func (x *AgentSessionTurnStateUpdate) GetOutcome() string {
	if x == nil {
		return ""
	}
	return x.Outcome
}
func (x *AgentSessionTurnStateUpdate) GetFileChanges() *structpb.Struct {
	if x == nil {
		return nil
	}
	return x.FileChanges
}
func (x *AgentSessionTurnStateUpdate) GetStartedAtUnixMs() int64 {
	if x == nil {
		return 0
	}
	return x.StartedAtUnixMs
}
func (x *AgentSessionTurnStateUpdate) GetCompletedAtUnixMs() int64 {
	if x == nil {
		return 0
	}
	return x.CompletedAtUnixMs
}

type AgentSessionStateUpdate struct {
	Provider          string
	ProviderSessionId string
	Model             string
	Cwd               string
	Title             string
	LifecycleStatus   string
	CurrentPhase      string
	OccurredAtUnixMs  int64
	StartedAtUnixMs   int64
	EndedAtUnixMs     int64
	Turn              *AgentSessionTurnStateUpdate
}

func (x *AgentSessionStateUpdate) GetProvider() string {
	if x == nil {
		return ""
	}
	return x.Provider
}
func (x *AgentSessionStateUpdate) GetProviderSessionId() string {
	if x == nil {
		return ""
	}
	return x.ProviderSessionId
}
func (x *AgentSessionStateUpdate) GetModel() string {
	if x == nil {
		return ""
	}
	return x.Model
}
func (x *AgentSessionStateUpdate) GetCwd() string {
	if x == nil {
		return ""
	}
	return x.Cwd
}
func (x *AgentSessionStateUpdate) GetTitle() string {
	if x == nil {
		return ""
	}
	return x.Title
}
func (x *AgentSessionStateUpdate) GetLifecycleStatus() string {
	if x == nil {
		return ""
	}
	return x.LifecycleStatus
}
func (x *AgentSessionStateUpdate) GetCurrentPhase() string {
	if x == nil {
		return ""
	}
	return x.CurrentPhase
}
func (x *AgentSessionStateUpdate) GetOccurredAtUnixMs() int64 {
	if x == nil {
		return 0
	}
	return x.OccurredAtUnixMs
}
func (x *AgentSessionStateUpdate) GetStartedAtUnixMs() int64 {
	if x == nil {
		return 0
	}
	return x.StartedAtUnixMs
}
func (x *AgentSessionStateUpdate) GetEndedAtUnixMs() int64 {
	if x == nil {
		return 0
	}
	return x.EndedAtUnixMs
}
func (x *AgentSessionStateUpdate) GetTurn() *AgentSessionTurnStateUpdate {
	if x == nil {
		return nil
	}
	return x.Turn
}

type AgentSessionMessageUpdate struct {
	MessageId         string
	TurnId            string
	Role              string
	Kind              string
	Status            string
	ContentDelta      string
	Payload           *structpb.Struct
	OccurredAtUnixMs  int64
	StartedAtUnixMs   int64
	CompletedAtUnixMs int64
}

func (x *AgentSessionMessageUpdate) GetMessageId() string {
	if x == nil {
		return ""
	}
	return x.MessageId
}
func (x *AgentSessionMessageUpdate) GetTurnId() string {
	if x == nil {
		return ""
	}
	return x.TurnId
}
func (x *AgentSessionMessageUpdate) GetRole() string {
	if x == nil {
		return ""
	}
	return x.Role
}
func (x *AgentSessionMessageUpdate) GetKind() string {
	if x == nil {
		return ""
	}
	return x.Kind
}
func (x *AgentSessionMessageUpdate) GetStatus() string {
	if x == nil {
		return ""
	}
	return x.Status
}
func (x *AgentSessionMessageUpdate) GetContentDelta() string {
	if x == nil {
		return ""
	}
	return x.ContentDelta
}
func (x *AgentSessionMessageUpdate) GetPayload() *structpb.Struct {
	if x == nil {
		return nil
	}
	return x.Payload
}
func (x *AgentSessionMessageUpdate) GetOccurredAtUnixMs() int64 {
	if x == nil {
		return 0
	}
	return x.OccurredAtUnixMs
}
func (x *AgentSessionMessageUpdate) GetStartedAtUnixMs() int64 {
	if x == nil {
		return 0
	}
	return x.StartedAtUnixMs
}
func (x *AgentSessionMessageUpdate) GetCompletedAtUnixMs() int64 {
	if x == nil {
		return 0
	}
	return x.CompletedAtUnixMs
}

type AgentContextIdentity struct {
	Known             bool
	Provider          string
	ProviderSessionId string
}

func (x *AgentContextIdentity) GetKnown() bool {
	return x != nil && x.Known
}
func (x *AgentContextIdentity) GetProvider() string {
	if x == nil {
		return ""
	}
	return x.Provider
}
func (x *AgentContextIdentity) GetProviderSessionId() string {
	if x == nil {
		return ""
	}
	return x.ProviderSessionId
}

type ActivePeersRequest struct {
	RoomId      string
	WorkspaceId string
	Cwd         string
	Self        *AgentContextIdentity
}

func (x *ActivePeersRequest) GetRoomId() string {
	if x == nil {
		return ""
	}
	return x.RoomId
}
func (x *ActivePeersRequest) GetWorkspaceId() string {
	if x == nil {
		return ""
	}
	return x.WorkspaceId
}
func (x *ActivePeersRequest) GetCwd() string {
	if x == nil {
		return ""
	}
	return x.Cwd
}
func (x *ActivePeersRequest) GetSelf() *AgentContextIdentity {
	if x == nil {
		return nil
	}
	return x.Self
}

type ActivePeerAgent struct {
	AgentId           string
	UserId            string
	Provider          string
	ProviderSessionId string
	EffectiveStatus   string
	WorkPhase         string
	Title             string
	Cwd               string
	UpdatedAtUnixMs   int64
	IsSelfSet         bool
	IsSelf            bool
}

func (x *ActivePeerAgent) GetAgentId() string {
	if x == nil {
		return ""
	}
	return x.AgentId
}
func (x *ActivePeerAgent) GetUserId() string {
	if x == nil {
		return ""
	}
	return x.UserId
}
func (x *ActivePeerAgent) GetProvider() string {
	if x == nil {
		return ""
	}
	return x.Provider
}
func (x *ActivePeerAgent) GetProviderSessionId() string {
	if x == nil {
		return ""
	}
	return x.ProviderSessionId
}
func (x *ActivePeerAgent) GetEffectiveStatus() string {
	if x == nil {
		return ""
	}
	return x.EffectiveStatus
}
func (x *ActivePeerAgent) GetWorkPhase() string {
	if x == nil {
		return ""
	}
	return x.WorkPhase
}
func (x *ActivePeerAgent) GetTitle() string {
	if x == nil {
		return ""
	}
	return x.Title
}
func (x *ActivePeerAgent) GetCwd() string {
	if x == nil {
		return ""
	}
	return x.Cwd
}
func (x *ActivePeerAgent) GetUpdatedAtUnixMs() int64 {
	if x == nil {
		return 0
	}
	return x.UpdatedAtUnixMs
}
func (x *ActivePeerAgent) GetIsSelfSet() bool {
	return x != nil && x.IsSelfSet
}
func (x *ActivePeerAgent) GetIsSelf() bool {
	return x != nil && x.IsSelf
}

type ActivePeersResponse struct {
	Agents []*ActivePeerAgent
}

func (x *ActivePeersResponse) GetAgents() []*ActivePeerAgent {
	if x == nil {
		return nil
	}
	return x.Agents
}
