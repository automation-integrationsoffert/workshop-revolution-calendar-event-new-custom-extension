import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeBlock, useBase, useRecords, expandRecord } from '@airtable/blocks/interface/ui';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    useDroppable,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './style.css';

// SVG Icon Component
function StatusIcon({ iconName, size = 20 }) {
    const iconPaths = {
        clock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>,
        gear: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V22a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H2a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V2a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H22a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
        wrench: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2l-5 5a4 4 0 0 1-5 5l-1 1a2 2 0 1 0 3 3l1-1a4 4 0 0 1 5-5l5-5z"/><circle cx="7" cy="17" r="3"/></svg>,
        tire: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v6m0 6v6m9-9h-6m-6 0H3m15.5 5.5l-4.2-4.2m-6.6 0l-4.2 4.2m0-9l4.2 4.2m6.6 0l4.2-4.2"/></svg>,
        campaign: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
    };

    return (
        <div style={{ width: size, height: size, color: 'white' }}>
            {iconPaths[iconName] || iconPaths.gear}
        </div>
    );
}

// Order Detail Card Component
function OrderDetailCard({ orderNo, orderRecord, orderTable, calendarEvents, eventsTable, onClose, statusColors, statusIcons, updatingRecords, recentlyUpdatedRecords, showVisualization = true, onHighlightEvent }) {

    // Early return if eventsTable is not available
    if (!eventsTable || !eventsTable.fields) {
        return (
            <div 
                className="order-detail-card flex-shrink-0"
                style={{ 
                    width: '280px',
                    minWidth: '280px',
                    maxHeight: '400px',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative'
                }}
            >
                <div className="text-xs text-red-600">Error: Events table not available</div>
            </div>
        );
    }
    
    // Find Calendar Events that match this order number
    // Field name is exactly "Order"
    const orderField = eventsTable.fields.find(field => 
        field.name === 'Order'
    );
    
    // Get Order No field from Orders table to compare values
    const orderNoFieldInOrders = orderRecord?.table?.fields?.find(field => 
        field.name === 'Order No' || 
        field.name === 'Order No.' ||
        field.name.toLowerCase().includes('order no')
    );
    
    const matchingEvents = calendarEvents ? calendarEvents.filter(event => {
        if (!orderField) {
            console.log('Order field not found in Calendar Events');
            return false;
        }
        
        const eventOrderValue = event.getCellValue(orderField.name);
        if (!eventOrderValue) {
            return false;
        }
        
        // Handle linked records (array) - when Order field links to Orders table
        if (Array.isArray(eventOrderValue)) {
            return eventOrderValue.some(linkedRecord => {
                // First check: if the linked record's ID matches the order record's ID (most reliable)
                if (linkedRecord.id === orderRecord.id) {
                    console.log(`Matched by ID: ${linkedRecord.id} === ${orderRecord.id}`);
                    return true;
                }
                
                // Second check: try to get Order No from the linked record and compare
                if (orderNoFieldInOrders) {
                    try {
                        // Try different ways to get the Order No value
                        let linkedOrderNo = null;
                        
                        // Method 1: If linkedRecord has getCellValueAsString method
                        if (typeof linkedRecord.getCellValueAsString === 'function') {
                            linkedOrderNo = linkedRecord.getCellValueAsString(orderNoFieldInOrders.name);
                        }
                        // Method 2: If linkedRecord has getCellValue method
                        else if (typeof linkedRecord.getCellValue === 'function') {
                            const cellValue = linkedRecord.getCellValue(orderNoFieldInOrders.name);
                            linkedOrderNo = cellValue ? cellValue.toString() : null;
                        }
                        // Method 3: Try accessing as property
                        else if (linkedRecord[orderNoFieldInOrders.name]) {
                            linkedOrderNo = linkedRecord[orderNoFieldInOrders.name].toString();
                        }
                        // Method 4: Use name property as fallback
                        else {
                            linkedOrderNo = linkedRecord.name || linkedRecord.id;
                        }
                        
                        if (linkedOrderNo) {
                            const orderNoStr = orderNo.toString().trim();
                            const linkedOrderNoStr = linkedOrderNo.toString().trim();
                            
                            if (linkedOrderNoStr === orderNoStr) {
                                console.log(`Matched by Order No: ${linkedOrderNoStr} === ${orderNoStr}`);
                                return true;
                            }
                        }
                    } catch (e) {
                        console.log('Error getting Order No from linked record:', e);
                    }
                }
                
                return false;
            });
        }
        
        // Handle direct value (if Order field is a text field with order number)
        const eventOrderNo = eventOrderValue.toString().trim();
        const orderNoStr = orderNo.toString().trim();
        const matches = eventOrderNo === orderNoStr;
        if (matches) {
            console.log(`Matched by text value: ${eventOrderNo} === ${orderNoStr}`);
        }
        return matches;
    }) : [];
    
    console.log(`Found ${matchingEvents.length} matching events for order ${orderNo}`);
    console.log('Order field found:', orderField?.name);
    console.log('Order No field in Orders table:', orderNoFieldInOrders?.name);
    console.log('All Calendar Events fields:', eventsTable.fields.map(f => f.name));
    
    // Field names are exactly: Visualization, Arbetsorder, Mekaniker
    const visualizationField = eventsTable.fields.find(f => 
        f.name === 'Visualization'
    );
    
    // Try to find Arbetsorder field - could be "Arbetsorder" or "Arbetsorder beskrivning"
    const arbetsorderField = eventsTable.fields.find(f => 
        f.name === 'Arbetsorder' ||
        f.name === 'Arbetsorder beskrivning' ||
        f.name.toLowerCase() === 'arbetsorder'
    );
    
    const mekanikerField = eventsTable.fields.find(f => 
        f.name === 'Mekaniker'
    );
    
    console.log('Fields found:', {
        visualizationField: visualizationField?.name || 'NOT FOUND',
        arbetsorderField: arbetsorderField?.name || 'NOT FOUND',
        mekanikerField: mekanikerField?.name || 'NOT FOUND'
    });
    
    // If no matching events but we have calendar events, log why
    if (matchingEvents.length === 0 && calendarEvents && calendarEvents.length > 0) {
        console.log('Sample event Order field values:', calendarEvents.slice(0, 3).map(ev => {
            const orderVal = orderField ? ev.getCellValue(orderField.name) : null;
            return {
                eventId: ev.id,
                orderValue: orderVal,
                orderValueType: typeof orderVal,
                isArray: Array.isArray(orderVal)
            };
        }));
    }
    
    // Get Fordon from Orders table where Order No matches the selected order number
    let fordon = '';
    let fordonField = null;
    
    // Use orderTable if provided, otherwise get from orderRecord
    const ordersTable = orderTable || orderRecord?.table;
    
    if (ordersTable && orderRecord) {
        console.log('Getting Fordon from Orders table:', {
            orderNo: orderNo,
            orderRecordId: orderRecord.id,
            tableName: ordersTable?.name,
            availableFields: ordersTable?.fields?.map(f => f.name) || []
        });
        
        // Find Fordon field in Orders table - try exact match first, then case-insensitive
        fordonField = ordersTable.fields?.find(f => 
            f.name === 'Fordon'
        ) || ordersTable.fields?.find(f => 
            f.name.toLowerCase() === 'fordon' ||
            f.name.toLowerCase().includes('fordon')
        ) || null;
        
        if (fordonField) {
            try {
                // Try getCellValueAsString first
                fordon = orderRecord.getCellValueAsString(fordonField.name) || '';
                
                // If empty, try getCellValue
                if (!fordon) {
                    const fordonValue = orderRecord.getCellValue(fordonField.name);
                    if (fordonValue) {
                        fordon = String(fordonValue);
                    }
                }
                
                console.log('Fordon retrieved:', {
                    fieldName: fordonField.name,
                    value: fordon || 'empty',
                    fieldType: fordonField.type
                });
            } catch (e) {
                console.error('Error getting Fordon:', e);
                // Try alternative method
                try {
                    const fordonValue = orderRecord.getCellValue(fordonField.name);
                    fordon = fordonValue ? String(fordonValue) : '';
                    console.log('Fordon retrieved (alternative method):', fordon || 'empty');
                } catch (e2) {
                    console.error('Error getting Fordon (alternative method):', e2);
                }
            }
        } else {
            console.warn('Fordon field not found in Orders table. Available fields:', ordersTable.fields?.map(f => f.name) || []);
        }
    } else {
        console.error('Cannot get Fordon - missing ordersTable or orderRecord:', {
            hasOrderTable: !!orderTable,
            hasOrderRecord: !!orderRecord,
            orderRecordTable: orderRecord?.table?.name
        });
    }
    
    const eventDetails = matchingEvents.map((event, index) => {
                            let imageUrl = null;
                                if (event && eventsTable) {
                                    try {
                                        const attachmentField =
                                            eventsTable.fields.find(
                                                f => f.name.toLowerCase().trim() === 'attachments'
                                            );
                                        if (attachmentField) {
                                            const attachments = event.getCellValue(attachmentField.name);
                                            if (attachments && Array.isArray(attachments) && attachments.length > 0) {
                                                imageUrl =
                                                    attachments[0].url ||
                                                    attachments[0].thumbnails?.large?.url ||
                                                    attachments[0].thumbnails?.small?.url;
                                            }
                                        } else {
                                            console.warn("⚠️ Attachments field not found in Calendar Events table. Available fields:", eventsTable.fields.map(f => f.name));
                                        }
                                    } catch (e) {
                                        console.error('Error getting image:', e);
                                    }
                                }
                            
                            let visualization = '';
                            let arbetsorder = '';
                            let mekanikerNames = '';
                            
                            try {
                                if (event && visualizationField) {
                                    visualization = event.getCellValueAsString(visualizationField.name) || '';
                                }
                            } catch (e) {
                                console.error('Error getting Visualization:', e);
                            }
                            
                            try {
                                if (event && arbetsorderField) {
                                    arbetsorder = event.getCellValueAsString(arbetsorderField.name) || '';
                                    console.log(`Arbetsorder value for event ${index + 1}:`, arbetsorder || 'empty');
                                } else {
                                    console.log(`Arbetsorder field not found for event ${index + 1}`);
                                }
                            } catch (e) {
                                console.error('Error getting Arbetsorder:', e);
                            }
                            
                            try {
                                if (event && mekanikerField) {
                                    const mekaniker = event.getCellValue(mekanikerField.name) || [];
                                    if (Array.isArray(mekaniker)) {
                                        mekanikerNames = mekaniker.map(m => {
                                            if (typeof m === 'string') return m;
                                            if (m && m.name) return m.name;
                                            if (m && m.value) return m.value;
                                            return String(m);
                                        }).filter(Boolean).join(', ');
                                    }
                                }
                            } catch (e) {
                                console.error('Error getting Mekaniker:', e);
                            }
                            
                            console.log(`Event ${index + 1} (${event.id}) data:`, {
                                hasImage: !!imageUrl,
                                hasArbetsorderField: !!arbetsorderField,
                                arbetsorderFieldName: arbetsorderField?.name,
                                visualization: visualization || 'empty',
                                arbetsorder: arbetsorder || 'empty',
                                mekanikerNames: mekanikerNames || 'empty'
                            });
                            
                            let status = 'Inget';
                            let statusIcon = '❓';
                            let backgroundColor = '#6b7280';
                            
                            try {
                                const orderStatus = event.getCellValue('Order Status');
                                if (orderStatus && Array.isArray(orderStatus) && orderStatus.length > 0) {
                                    status = orderStatus[0]?.value || orderStatus[0]?.name || 'Inget';
                                } else if (orderStatus && typeof orderStatus === 'string') {
                                    status = orderStatus;
                                }
                                
                                if (statusColors && statusColors[status]) {
                                    backgroundColor = statusColors[status];
                                }
                                if (statusIcons && statusIcons[status]) {
                                    statusIcon = statusIcons[status];
                                }
                            } catch (e) {
                                console.error('Error getting Order Status:', e);
                            }
        
        // Check if this is a delegated sub order (has both Starttid and Sluttid)
        // Delegated sub orders should have red text color but can still be draggable
        let isScheduled = false;
        let isDelegated = false;
        try {
            // Safely check for Starttid and Sluttid fields
            if (event && typeof event.getCellValue === 'function') {
                const starttid = event.getCellValue('Starttid');
                const sluttid = event.getCellValue('Sluttid');
                // Exclude lunch break events (they're virtual events, not sub orders)
                const isLunchBreak = event.isLunchBreak === true;
                // Delegated sub orders have both Starttid and Sluttid
                // Check that values are not null/undefined and are valid dates
                const hasStarttid = starttid !== null && starttid !== undefined;
                const hasSluttid = sluttid !== null && sluttid !== undefined;
                isDelegated = hasStarttid && hasSluttid && !isLunchBreak;
            }
        } catch (e) {
            // Silently handle errors - field might not exist or be accessible
            console.warn('Error checking Starttid/Sluttid for delegated status:', e);
        }

        return {
            key: event.id || index,
            event,
            imageUrl,
            visualization,
            arbetsorder,
            mekanikerNames,
            status,
            statusIcon,
            backgroundColor,
            isUpdating: updatingRecords && updatingRecords.has(event.id),
            isRecentlyUpdated: recentlyUpdatedRecords && recentlyUpdatedRecords.has(event.id),
            isScheduled,
            isDelegated,
        };
    });

    const unscheduledEvents = eventDetails.filter(detail => !detail.isScheduled);
    const scheduledEvents = eventDetails.filter(detail => detail.isScheduled);
    
    const { setNodeRef: setOrderDropRef, isOver: isOrderDropOver } = useDroppable({
        id: `order-detail-drop-${orderNo || 'unknown'}`
    });

                            return (
        <div 
            ref={setOrderDropRef}
            className="order-detail-card p-3 flex-shrink-0"
            style={{ 
                flexDirection: 'column',
                position: 'relative',
                overflow: 'hidden',
                border: isOrderDropOver ? '1px dashed #3b82f6' : undefined,
                borderRadius: isOrderDropOver ? '8px' : undefined
            }}
        >
            {/* Close button */}
            {/* <button
                onClick={onClose}
                className="absolute top-2 right-2 w-6 h-6 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center text-gray-600 text-xs font-bold z-10"
            >
                ×
            </button> */}
            
            {/* Order Number Header */}
            {/* <div className="font-bold text-sm mb-2 text-gray-700 border-b pb-1 pr-6">
                Order: {orderNo}
                {matchingEvents.length > 0 && (
                    <span className="text-xs font-normal text-gray-500 ml-2">
                        ({matchingEvents.length} event{matchingEvents.length > 1 ? 's' : ''})
                    </span>
                )}
            </div> */}
            
            {/* Horizontal scrollable list of matching events */}
            <div className="flex-1">
                {eventDetails.length > 0 ? (
                    <div className="flex gap-3 flex-nowrap" style={{ margin: 'auto' }}>
                        {unscheduledEvents.length > 0 && (
                            <SortableContext
                                items={unscheduledEvents.map(detail => `order-detail-${orderNo || 'unknown'}-${detail.event.id}`)}
                                strategy={verticalListSortingStrategy}
                            >
                                <>
                                    {unscheduledEvents.map(detail => (
                                <DraggableOrderEvent
                                            key={detail.key}
                                            event={detail.event}
                                            imageUrl={detail.imageUrl}
                                            visualization={detail.visualization}
                                    fordon={fordon}
                                            arbetsorder={detail.arbetsorder}
                                            mekanikerNames={detail.mekanikerNames}
                                            status={detail.status}
                                            statusIcon={detail.statusIcon}
                                            backgroundColor={detail.backgroundColor}
                                            isUpdating={detail.isUpdating}
                                            isRecentlyUpdated={detail.isRecentlyUpdated}
                                            orderNo={orderNo}
                                            orderRecord={orderRecord}
                                            onClose={onClose}
                                            showVisualization={showVisualization}
                                            isScheduled={detail.isScheduled}
                                            isDelegated={detail.isDelegated}
                                            onHighlightEvent={onHighlightEvent}
                                        />
                                    ))}
                                </>
                            </SortableContext>
                        )}

                        {scheduledEvents.length > 0 && scheduledEvents.map(detail => (
                            <StaticOrderEvent
                                key={`static-${detail.key}`}
                                event={detail.event}
                                imageUrl={detail.imageUrl}
                                visualization={detail.visualization}
                                fordon={fordon}
                                arbetsorder={detail.arbetsorder}
                                mekanikerNames={detail.mekanikerNames}
                                status={detail.status}
                                statusIcon={detail.statusIcon}
                                backgroundColor={detail.backgroundColor}
                                isUpdating={detail.isUpdating}
                                isRecentlyUpdated={detail.isRecentlyUpdated}
                                orderNo={orderNo}
                                orderRecord={orderRecord}
                                onClose={onClose}
                                showVisualization={showVisualization}
                                isScheduled={detail.isScheduled}
                                isDelegated={detail.isDelegated}
                                onHighlightEvent={onHighlightEvent}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-xs text-gray-500 mt-4 p-4 text-center">
                        <div className="mb-2 font-semibold">No Orders found</div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Calendar Images Gallery Component (shows at top)
function CalendarImagesGallery({ events, eventsTable }) {

    if (!eventsTable || !events || events.length === 0) {
        return null;
    }
    
    // Verify this is the Calendar Events table, not Orders table
    if (eventsTable.name !== 'Calendar Events' && eventsTable.name !== 'CalendarEvents') {
        return null;
    }
    
    // Collect all images from all Calendar Events
    // Each Calendar Events record has only one attachment image
    // Use the exact field name "Attachments" directly (no field searching needed)
    const allImages = [];
    
    events.forEach((event) => {
        try {
            // Get attachments field using exact field name "Attachments" from Calendar Events table
            const attachmentField =
                eventsTable.fields.find(
                    f => f.name.toLowerCase().trim() === 'attachments' ||
                        f.type === 'multipleAttachment'
                );

            const attachments = attachmentField
                ? event.getCellValue(attachmentField.name)
                : null;
            
            // Check if attachments exist and have items
            if (!attachments || (Array.isArray(attachments) && attachments.length === 0)) {
                return; // Skip this event
            }
            
            // Get the first attachment (each event has only one)
            const attachment = Array.isArray(attachments) ? attachments[0] : attachments;
            
            if (attachment && attachment.url) {
                // Use the URL directly from the attachment object (as shown in working example)
                allImages.push({
                    url: attachment.url,
                    eventId: event.id,
                    id: attachment.id || `${event.id}-0`
                });
            }
        } catch (e) {
            console.error('CalendarImagesGallery - Error getting attachments:', e);
        }
    });
    
    if (allImages.length === 0) {
        console.log('CalendarImagesGallery: No images found');
        return null;
    }
    
    return (
        <div 
            className="calendar-images-gallery bg-gray-50 border-b border-gray-300 p-3 mb-4"
            style={{
                width: '100%',
                overflowX: 'auto',
                overflowY: 'hidden'
            }}
        >
            {/* <div className="flex gap-3" style={{ minWidth: 'fit-content' }}>
                {allImages.map((image, index) => (
                    <div
                        key={image.id}
                        className="image-item flex-shrink-0"
                        style={{
                            width: '150px',
                            height: '150px',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            border: '2px solid #e5e7eb',
                            cursor: 'pointer',
                            transition: 'transform 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.05)';
                            e.currentTarget.style.borderColor = '#3b82f6';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.borderColor = '#e5e7eb';
                        }}
                        onClick={() => {
                            // Expand the event record when image is clicked
                            const event = events.find(e => e.id === image.eventId);
                            if (event) {
                                expandRecord(event);
                            }
                        }}
                    >
                        <img
                            src={image.url}
                            alt={`Calendar Event Image ${index + 1}`}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                display: 'block'
                            }}
                            onError={(e) => {
                                console.error(`CalendarImagesGallery - Failed to load image: ${image.url}`, e);
                                e.target.style.display = 'none';
                                const errorDiv = document.createElement('div');
                                errorDiv.className = 'flex items-center justify-center h-full text-xs text-gray-400';
                                errorDiv.textContent = 'Image failed to load';
                                e.target.parentElement.appendChild(errorDiv);
                            }}
                            onLoad={() => {
                                console.log(`CalendarImagesGallery - Successfully loaded image: ${image.url}`);
                            }}
                        />
                    </div>
                ))}
            </div> */}
        </div>
    );
}

// Left Side Order Detail Card Component (vertical layout for events, no Visualization)
function LeftSideOrderDetailCard({ orderNo, orderRecord, orderTable, calendarEvents, eventsTable, onClose, statusColors, statusIcons, updatingRecords, recentlyUpdatedRecords, onHighlightEvent }) {
    const [isExpanded, setIsExpanded] = useState(true);
    const contentRef = useRef(null);
    const [contentHeight, setContentHeight] = useState('2000px'); // Large initial value to show content
    
    // Early return if eventsTable is not available
    if (!eventsTable || !eventsTable.fields) {
        return (
            <div 
                className="left-side-order-detail-card flex-shrink-0"
                style={{ 
                    width: '280px',
                    minWidth: '280px',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative'
                }}
            >
                <div className="text-xs text-red-600">Error: Events table not available</div>
            </div>
        );
    }
    
    // Find Calendar Events that match this order number
    const orderField = eventsTable.fields.find(field => field.name === 'Order');
    const orderNoFieldInOrders = orderRecord?.table?.fields?.find(field => 
        field.name === 'Order No' || 
        field.name === 'Order No.' ||
        field.name.toLowerCase().includes('order no')
    );
    
    const matchingEvents = calendarEvents ? calendarEvents.filter(event => {
        if (!orderField) return false;
        const eventOrderValue = event.getCellValue(orderField.name);
        if (!eventOrderValue) return false;
        if (Array.isArray(eventOrderValue)) {
            return eventOrderValue.some(linkedRecord => {
                if (linkedRecord.id === orderRecord.id) return true;
                if (orderNoFieldInOrders) {
                    try {
                        let linkedOrderNo = null;
                        if (typeof linkedRecord.getCellValueAsString === 'function') {
                            linkedOrderNo = linkedRecord.getCellValueAsString(orderNoFieldInOrders.name);
                        } else if (typeof linkedRecord.getCellValue === 'function') {
                            const cellValue = linkedRecord.getCellValue(orderNoFieldInOrders.name);
                            linkedOrderNo = cellValue ? cellValue.toString() : null;
                        } else if (linkedRecord[orderNoFieldInOrders.name]) {
                            linkedOrderNo = linkedRecord[orderNoFieldInOrders.name].toString();
                        } else {
                            linkedOrderNo = linkedRecord.name || linkedRecord.id;
                        }
                        if (linkedOrderNo) {
                            const orderNoStr = orderNo.toString().trim();
                            const linkedOrderNoStr = linkedOrderNo.toString().trim();
                            return linkedOrderNoStr === orderNoStr;
                        }
                    } catch (e) {
                        console.log('Error getting Order No from linked record:', e);
                    }
                }
                return false;
            });
        }
        const eventOrderNo = eventOrderValue.toString().trim();
        const orderNoStr = orderNo.toString().trim();
        return eventOrderNo === orderNoStr;
    }) : [];
    
    // Note: Starttid and Sluttid fields don't exist, so all events are treated as unscheduled
    const unscheduledEvents = matchingEvents;
    const scheduledEvents = [];
    const allEvents = matchingEvents;
    
    const visualizationField = eventsTable.fields.find(f => f.name === 'Visualization');
    const arbetsorderField = eventsTable.fields.find(f => 
        f.name === 'Arbetsorder' ||
        f.name === 'Arbetsorder beskrivning' ||
        f.name.toLowerCase() === 'arbetsorder'
    );
    const mekanikerField = eventsTable.fields.find(f => f.name === 'Mekaniker');
    
    // Get Fordon from Orders table
    let fordon = '';
    const ordersTable = orderTable || orderRecord?.table;
    if (ordersTable && orderRecord) {
        const fordonField = ordersTable.fields?.find(f => 
            f.name === 'Fordon'
        ) || ordersTable.fields?.find(f => 
            f.name.toLowerCase() === 'fordon' || f.name.toLowerCase().includes('fordon')
        ) || null;
        if (fordonField) {
            try {
                fordon = orderRecord.getCellValueAsString(fordonField.name) || '';
                if (!fordon) {
                    const fordonValue = orderRecord.getCellValue(fordonField.name);
                    if (fordonValue) {
                        fordon = String(fordonValue);
                    }
                }
            } catch (e) {
                console.error('Error getting Fordon:', e);
            }
        }
    }
    
    // Don't render the component if there are no events at all
    if (allEvents.length === 0) {
        return null;
    }
    
    // Measure content height for smooth accordion animation
    useEffect(() => {
        const measureHeight = () => {
            try {
                if (contentRef.current) {
                    const height = contentRef.current.scrollHeight;
                    if (height > 0) {
                        setContentHeight(`${height}px`);
                    }
                }
            } catch (error) {
                // Silently handle errors
            }
        };
        
        // Measure after content is rendered
        if (isExpanded && allEvents.length > 0) {
            // Use setTimeout to ensure DOM is updated
            const timeoutId = setTimeout(measureHeight, 50);
            return () => clearTimeout(timeoutId);
        }
    }, [allEvents.length, isExpanded]);
    
    const { setNodeRef: setLeftOrderDropRef, isOver: isLeftDropOver } = useDroppable({
        id: `left-order-detail-drop-${orderNo || 'unknown'}`
    });
    
    return (
        <div 
            ref={setLeftOrderDropRef}
            className="left-side-order-detail-card p-3 flex-shrink-0"
            style={{ 
                flexDirection: 'column',
                position: 'relative',
                overflow: 'hidden',
                width: '100%',
                border: isLeftDropOver ? '1px dashed #3b82f6' : undefined,
                borderRadius: isLeftDropOver ? '8px' : undefined
            }}
        >
            {/* Accordion Header - Order Number */}
            <div 
                className="w-full text-xs font-semibold text-gray-700 border-b border-dashed border-gray-300 pb-1 mb-3 cursor-pointer hover:bg-gray-50 transition-colors rounded px-2 py-1 flex items-center justify-between"
                onClick={() => {
                    setIsExpanded(!isExpanded);
                }}
                style={{ userSelect: 'none' }}
                role="button"
                aria-expanded={isExpanded}
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setIsExpanded(!isExpanded);
                    }
                }}
            >
                <span>{orderNo ? `Order ${orderNo}` : 'Order'}</span>
                <span 
                    style={{ 
                        display: 'inline-block',
                        fontSize: '12px',
                        marginLeft: '8px',
                        fontWeight: 'bold',
                        color: '#6b7280',
                        transition: 'transform 0.2s ease'
                    }}
                    aria-hidden="true"
                >
                    {isExpanded ? '▲' : '▼'}
                </span>
            </div>
            
            {/* Accordion Content - Sub Orders List */}
            <div 
                style={{
                    maxHeight: isExpanded ? contentHeight : '0',
                    opacity: isExpanded ? 1 : 0,
                    overflow: 'hidden',
                    transition: 'max-height 0.3s ease, opacity 0.3s ease'
                }}
                aria-hidden={!isExpanded}
            >
                <div className="flex-1" ref={contentRef} style={{ paddingTop: '4px' }}>
                    {allEvents.length > 0 ? (
                        <SortableContext
                            items={unscheduledEvents.map(event => `left-order-detail-${orderNo || 'unknown'}-${event.id}`)}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="flex flex-col gap-3" style={{ margin: 'auto' }}>
                                {/* Render unscheduled events first (gray) */}
                                {unscheduledEvents.map((event, index) => {
                                let imageUrl = null;
                                if (event && eventsTable) {
                                    try {
                                        const attachmentField = eventsTable.fields.find(
                                            f => f.name.toLowerCase().trim() === 'attachments'
                                        );
                                        if (attachmentField) {
                                            const attachments = event.getCellValue(attachmentField.name);
                                            if (attachments && Array.isArray(attachments) && attachments.length > 0) {
                                                imageUrl = attachments[0].url ||
                                                    attachments[0].thumbnails?.large?.url ||
                                                    attachments[0].thumbnails?.small?.url;
                                            }
                                        }
                                    } catch (e) {
                                        console.error('Error getting image:', e);
                                    }
                                }
                                
                                let visualization = '';
                                let arbetsorder = '';
                                let mekanikerNames = '';
                                
                                try {
                                    if (event && visualizationField) {
                                        visualization = event.getCellValueAsString(visualizationField.name) || '';
                                    }
                                } catch (e) {
                                    console.error('Error getting Visualization:', e);
                                }
                                
                                try {
                                    if (event && arbetsorderField) {
                                        arbetsorder = event.getCellValueAsString(arbetsorderField.name) || '';
                                    }
                                } catch (e) {
                                    console.error('Error getting Arbetsorder:', e);
                                }
                                
                                try {
                                    if (event && mekanikerField) {
                                        const mekaniker = event.getCellValue(mekanikerField.name) || [];
                                        if (Array.isArray(mekaniker)) {
                                            mekanikerNames = mekaniker.map(m => {
                                                if (typeof m === 'string') return m;
                                                if (m && m.name) return m.name;
                                                if (m && m.value) return m.value;
                                                return String(m);
                                            }).filter(Boolean).join(', ');
                                        }
                                    }
                                } catch (e) {
                                    console.error('Error getting Mekaniker:', e);
                                }
                                
                                let status = 'Inget';
                                let statusIcon = '❓';
                                let backgroundColor = '#6b7280';
                                
                                try {
                                    const orderStatus = event.getCellValue('Order Status');
                                    if (orderStatus && Array.isArray(orderStatus) && orderStatus.length > 0) {
                                        status = orderStatus[0]?.value || orderStatus[0]?.name || 'Inget';
                                    } else if (orderStatus && typeof orderStatus === 'string') {
                                        status = orderStatus;
                                    }
                                    
                                    if (statusColors && statusColors[status]) {
                                        backgroundColor = statusColors[status];
                                    }
                                    if (statusIcons && statusIcons[status]) {
                                        statusIcon = statusIcons[status];
                                    }
                                } catch (e) {
                                    console.error('Error getting Order Status:', e);
                                }
                                
                                // Check if event is scheduled (has both Starttid and Sluttid)
                                let isScheduled = false;
                                try {
                                    const starttid = event.getCellValue('Starttid');
                                    const sluttid = event.getCellValue('Sluttid');
                                    isScheduled = !!(starttid && sluttid);
                                } catch (e) {
                                    console.error('Error checking if event is scheduled:', e);
                                }
                                
                                // Check if this is a delegated sub order
                                let isDelegated = false;
                                try {
                                    if (event && typeof event.getCellValue === 'function') {
                                        const starttid = event.getCellValue('Starttid');
                                        const sluttid = event.getCellValue('Sluttid');
                                        const isLunchBreak = event.isLunchBreak === true;
                                        const hasStarttid = starttid !== null && starttid !== undefined;
                                        const hasSluttid = sluttid !== null && sluttid !== undefined;
                                        isDelegated = hasStarttid && hasSluttid && !isLunchBreak;
                                    }
                                } catch (e) {
                                    console.warn('Error checking Starttid/Sluttid for delegated status:', e);
                                }
                                
                                return (
                                    <DraggableOrderEvent
                                        key={event.id || index}
                                        customUniqueId={`left-order-detail-${orderNo || 'unknown'}-${event.id}`}
                                        event={event}
                                        imageUrl={imageUrl}
                                        visualization={visualization}
                                        fordon={fordon}
                                        mekanikerNames={mekanikerNames}
                                        status={status}
                                        statusIcon={statusIcon}
                                        backgroundColor={backgroundColor}
                                        isUpdating={updatingRecords && updatingRecords.has(event.id)}
                                        isRecentlyUpdated={recentlyUpdatedRecords && recentlyUpdatedRecords.has(event.id)}
                                        orderNo={orderNo}
                                        orderRecord={orderRecord}
                                        onClose={onClose}
                                        isScheduled={isScheduled}
                                        variant="left"
                                        showVisualization={true}
                                        arbetsorder={arbetsorder}
                                        isDelegated={isDelegated}
                                        onHighlightEvent={onHighlightEvent}
                                    />
                                );
                            })}
                            
                            {/* Render scheduled events (red) */}
                            {scheduledEvents.map((event, index) => {
                                let imageUrl = null;
                                if (event && eventsTable) {
                                    try {
                                        const attachmentField = eventsTable.fields.find(
                                            f => f.name.toLowerCase().trim() === 'attachments'
                                        );
                                        if (attachmentField) {
                                            const attachments = event.getCellValue(attachmentField.name);
                                            if (attachments && Array.isArray(attachments) && attachments.length > 0) {
                                                imageUrl = attachments[0].url ||
                                                    attachments[0].thumbnails?.large?.url ||
                                                    attachments[0].thumbnails?.small?.url;
                                            }
                                        }
                                    } catch (e) {
                                        console.error('Error getting image:', e);
                                    }
                                }
                                
                                let visualization = '';
                                let arbetsorder = '';
                                let mekanikerNames = '';
                                
                                try {
                                    if (event && visualizationField) {
                                        visualization = event.getCellValueAsString(visualizationField.name) || '';
                                    }
                                } catch (e) {
                                    console.error('Error getting Visualization:', e);
                                }
                                
                                try {
                                    if (event && arbetsorderField) {
                                        arbetsorder = event.getCellValueAsString(arbetsorderField.name) || '';
                                    }
                                } catch (e) {
                                    console.error('Error getting Arbetsorder:', e);
                                }
                                
                                try {
                                    if (event && mekanikerField) {
                                        const mekaniker = event.getCellValue(mekanikerField.name) || [];
                                        if (Array.isArray(mekaniker)) {
                                            mekanikerNames = mekaniker.map(m => {
                                                if (typeof m === 'string') return m;
                                                if (m && m.name) return m.name;
                                                if (m && m.value) return m.value;
                                                return String(m);
                                            }).filter(Boolean).join(', ');
                                        }
                                    }
                                } catch (e) {
                                    console.error('Error getting Mekaniker:', e);
                                }
                                
                                let status = 'Inget';
                                let statusIcon = '❓';
                                let backgroundColor = '#6b7280';
                                
                                try {
                                    const orderStatus = event.getCellValue('Order Status');
                                    if (orderStatus && Array.isArray(orderStatus) && orderStatus.length > 0) {
                                        status = orderStatus[0]?.value || orderStatus[0]?.name || 'Inget';
                                    } else if (orderStatus && typeof orderStatus === 'string') {
                                        status = orderStatus;
                                    }
                                    
                                    if (statusColors && statusColors[status]) {
                                        backgroundColor = statusColors[status];
                                    }
                                    if (statusIcons && statusIcons[status]) {
                                        statusIcon = statusIcons[status];
                                    }
                                } catch (e) {
                                    console.error('Error getting Order Status:', e);
                                }
                                
                                // Scheduled events always have isScheduled = true
                                const isScheduled = true;
                                
                                // Check if this is a delegated sub order (scheduled events are delegated)
                                const isDelegated = true; // Scheduled events are always delegated
                                
                                return (
                                    <DraggableOrderEvent
                                        key={event.id || `scheduled-${index}`}
                                        customUniqueId={`left-order-detail-${orderNo || 'unknown'}-${event.id}`}
                                        event={event}
                                        imageUrl={imageUrl}
                                        visualization={visualization}
                                        fordon={fordon}
                                        mekanikerNames={mekanikerNames}
                                        status={status}
                                        statusIcon={statusIcon}
                                        backgroundColor={backgroundColor}
                                        isUpdating={updatingRecords && updatingRecords.has(event.id)}
                                        isRecentlyUpdated={recentlyUpdatedRecords && recentlyUpdatedRecords.has(event.id)}
                                        orderNo={orderNo}
                                        orderRecord={orderRecord}
                                        onClose={onClose}
                                        isScheduled={isScheduled}
                                        variant="left"
                                        showVisualization={true}
                                        arbetsorder={arbetsorder}
                                        isDelegated={isDelegated}
                                        onHighlightEvent={onHighlightEvent}
                                    />
                                );
                            })}
                        </div>
                    </SortableContext>
                ) : null}
                </div>
            </div>
        </div>
    );
}

// Left Side Order Details Panel Component (vertical layout for events, no Visualization)
function LeftSideOrderDetailsPanel({ orders, orderTable, calendarEvents, eventsTable, onCloseOrder, statusColors, statusIcons, updatingRecords, recentlyUpdatedRecords, onHighlightEvent }) {
    console.log('LeftSideOrderDetailsPanel - orders count:', orders?.length);
    
    // Make the entire panel droppable
    const { setNodeRef: setPanelDropRef, isOver: isPanelDropOver } = useDroppable({
        id: 'left-side-panel-drop'
    });
    
    const containerStyle = {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px',
        gap: '16px',
        overflowY: 'auto',
        alignItems: 'center',
        border: isPanelDropOver ? '2px dashed #3b82f6' : undefined,
        borderRadius: isPanelDropOver ? '8px' : undefined,
        backgroundColor: isPanelDropOver ? '#f0f9ff' : undefined,
        transition: 'all 0.2s'
    };
    
    if (!orderTable || !eventsTable) {
        console.log('LeftSideOrderDetailsPanel - Missing orderTable or eventsTable');
        return (
            <div className="left-side-order-details-panel" style={containerStyle}>
                <div className="text-xs text-red-600 text-center w-full border border-dashed border-red-300 rounded p-3 bg-red-50">
                    Unable to load order details. Missing table configuration.
                </div>
            </div>
        );
    }
    
    const orderNoField = orderTable?.fields?.find(field => 
        field.name === 'Order No' || 
        field.name === 'Order No.' ||
        field.name.toLowerCase().includes('order no')
    );
    
    const availableOrders = Array.isArray(orders) ? orders : [];
    
    const orderField = eventsTable.fields.find(field => field.name === 'Order');
    
    // Find Starttid and Sluttid fields
    const starttidField = eventsTable.fields.find(field => 
        field.name === 'Starttid' || 
        field.name.toLowerCase() === 'starttid'
    );
    const sluttidField = eventsTable.fields.find(field => 
        field.name === 'Sluttid' || 
        field.name.toLowerCase() === 'sluttid'
    );
    
    if (!orderField || !calendarEvents) {
        console.log('LeftSideOrderDetailsPanel - Missing orderField or calendarEvents');
        return (
            <div className="left-side-order-details-panel" style={containerStyle}>
                <div className="text-xs text-gray-500 text-center py-6 w-full border border-dashed border-gray-300 rounded bg-gray-50">
                    No Orders to assign
                </div>
            </div>
        );
    }
    
    if (!starttidField || !sluttidField) {
        console.warn('LeftSideOrderDetailsPanel - Starttid or Sluttid fields not found:', {
            starttidField: starttidField?.name || 'NOT FOUND',
            sluttidField: sluttidField?.name || 'NOT FOUND'
        });
    }
    
    // Filter orders that have at least one undelegated (unscheduled) sub order
    const ordersWithUnscheduledEvents = availableOrders.filter(order => {
        const orderNo = orderNoField ? order.getCellValueAsString(orderNoField.name) : order.id;
        const orderNoTrimmed = orderNo ? orderNo.toString().trim() : '';
        const matchingEvents = calendarEvents.filter(event => {
            const eventOrderValue = event.getCellValue(orderField.name);
            if (!eventOrderValue) return false;
            if (Array.isArray(eventOrderValue)) {
                return eventOrderValue.some(linkedRecord => linkedRecord.id === order.id);
            }
            const eventOrderNo = eventOrderValue.toString().trim();
            return eventOrderNo === orderNoTrimmed;
        });
        
        if (matchingEvents.length === 0) {
            return false;
        }
        
        // Return true only if there is at least one unscheduled event
        return matchingEvents.some(event => {
            try {
                if (!starttidField || !sluttidField) {
                    return true; // If fields not found, assume unscheduled
                }
                const starttid = event.getCellValue(starttidField.name);
                const sluttid = event.getCellValue(sluttidField.name);
                return !(starttid && sluttid);
            } catch (e) {
                console.error('Error checking event schedule for left panel:', e);
                return true; // If we can't check, assume unscheduled
            }
        });
    });
    
    console.log('LeftSideOrderDetailsPanel - ordersWithUnscheduledEvents:', ordersWithUnscheduledEvents.length);
    
    return (
        <div 
            ref={setPanelDropRef}
            className="left-side-order-details-panel"
            style={containerStyle}
        >
            {/* Header Title - Undelegated Tasks */}
            <div 
                style={{
                    fontSize: '14px', // Normal (12px) + 2px
                    fontWeight: 700,
                    color: '#6b7280',
                    marginBottom: '12px',
                    paddingBottom: '4px',
                    width: '100%',
                    textAlign: 'left'
                }}
            >
                Undelegated tasks
            </div>
            
            {ordersWithUnscheduledEvents.length === 0 ? (
                <div className="text-xs text-gray-500 text-center py-6 w-full border border-dashed border-gray-300 rounded bg-gray-50">
                    No Orders to assign
                </div>
            ) : (
                ordersWithUnscheduledEvents.map(order => {
                    const orderNo = orderNoField ? order.getCellValueAsString(orderNoField.name) : order.id;
                    return (
                        <LeftSideOrderDetailCard
                            key={order.id}
                            orderNo={orderNo}
                            orderRecord={order}
                            orderTable={orderTable}
                            calendarEvents={calendarEvents || []}
                            eventsTable={eventsTable}
                            onClose={() => onCloseOrder(orderNo)}
                            statusColors={statusColors}
                            statusIcons={statusIcons}
                            updatingRecords={updatingRecords}
                            recentlyUpdatedRecords={recentlyUpdatedRecords}
                            onHighlightEvent={onHighlightEvent}
                        />
                    );
                })
            )}
        </div>
    );
}

// Order Details Panel Component (shows at top)
function OrderDetailsPanel({ selectedOrderNumbers, orders, orderTable, calendarEvents, eventsTable, onCloseOrder, statusColors, statusIcons, updatingRecords, recentlyUpdatedRecords, showVisualization = true, onHighlightEvent }) {
    console.log('OrderDetailsPanel - selectedOrderNumbers:', Array.from(selectedOrderNumbers));
    console.log('OrderDetailsPanel - orders count:', orders?.length);
    
    if (selectedOrderNumbers.size === 0) {
        return null;
    }
    
    // Early return if required props are missing
    if (!orderTable || !eventsTable) {
        console.log('OrderDetailsPanel - Missing orderTable or eventsTable');
        return null;
    }
    
    // Get selected order records
    const orderNoField = orderTable?.fields?.find(field => 
        field.name === 'Order No' || 
        field.name === 'Order No.' ||
        field.name.toLowerCase().includes('order no')
    );
    
    const selectedOrders = orders ? orders.filter(order => {
        if (!orderNoField) return false;
        const orderNo = order.getCellValueAsString(orderNoField.name);
        const orderNoTrimmed = orderNo ? orderNo.toString().trim() : '';
        const isSelected = selectedOrderNumbers.has(orderNoTrimmed);
        console.log('Checking order:', {
            orderId: order.id,
            orderNo: orderNo,
            orderNoTrimmed: orderNoTrimmed,
            selectedOrderNumbers: Array.from(selectedOrderNumbers),
            isSelected: isSelected
        });
        return isSelected;
    }) : [];
    
    console.log('OrderDetailsPanel - selectedOrders count:', selectedOrders.length);
    console.log('OrderDetailsPanel - selectedOrders:', selectedOrders.map(o => {
        const no = orderNoField ? o.getCellValueAsString(orderNoField.name) : o.id;
        return no;
    }));
    console.log('OrderDetailsPanel - selectedOrderNumbers Set:', Array.from(selectedOrderNumbers));
    
    if (selectedOrders.length === 0) {
        return null;
    }
    
    return (
        <div 
            className="order-details-panel"
            style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
            }}
        >
            <div 
                className="flex gap-3" 
                style={{ 
                    alignItems: 'flex-start', 
                    justifyContent: 'center',
                    flexDirection: 'row',
                    flexWrap: 'nowrap',
                    overflowX: 'auto'
                }}
            >
                {selectedOrders.map(order => {
                    const orderNo = orderNoField ? order.getCellValueAsString(orderNoField.name) : order.id;
                    console.log('Rendering OrderDetailCard for:', orderNo);
                    return (
                        <OrderDetailCard
                            key={order.id}
                            orderNo={orderNo}
                            orderRecord={order}
                            orderTable={orderTable}
                            calendarEvents={calendarEvents || []}
                            eventsTable={eventsTable}
                            onClose={() => onCloseOrder(orderNo)}
                            statusColors={statusColors}
                            statusIcons={statusIcons}
                            updatingRecords={updatingRecords}
                            recentlyUpdatedRecords={recentlyUpdatedRecords}
                            showVisualization={showVisualization}
                            onHighlightEvent={onHighlightEvent}
                        />
                    );
                })}
            </div>
        </div>
    );
}

// Order List Component
function OrderList({ orders, orderTable, selectedOrderNumbers = new Set(), onOrderClick }) {
    console.log('=== OrderList Component Rendering ===');
    console.log('orderTable:', orderTable?.name || 'NULL');
    console.log('orders count:', orders?.length || 0);
    console.log('orders array:', orders);
    
    // Always render the panel, even if there's an issue
    if (!orderTable) {
        console.log('Rendering: Order table not found state');
        return (
            <div 
                className="order-list-panel bg-white rounded-r-lg border-2 border-red-500" 
                style={{ 
                    width: '250px', 
                    minWidth: '250px',
                    height: '100%', 
                    minHeight: '500px',
                    display: 'flex', 
                    flexDirection: 'column', 
                    flexShrink: 0,
                    backgroundColor: '#ffffff',
                    position: 'relative',
                    zIndex: 100,
                    boxShadow: '-2px 0 8px rgba(0,0,0,0.1)'
                }}
            >
                <div className="px-4 py-3 border-b-2 border-red-300 bg-red-50 flex-shrink-0">
                    <h3 
                        style={{
                            fontSize: '14px', // Match "Undelegated tasks" size (Normal 12px + 2px)
                            fontWeight: 700,
                            color: '#6b7280',
                            margin: 0
                        }}
                    >
                        This week's Order
                    </h3>
                    <div className="text-xs text-red-600 mt-1">⚠️ DEBUG MODE</div>
                </div>
                <div className="flex-1 flex items-center justify-center p-4">
                    <div className="text-xs text-red-600 text-center">
                        <div className="mb-2 font-bold text-base">⚠️ Order table not found</div>
                        <div className="text-xs text-gray-600 mt-2 p-2 bg-gray-100 rounded">
                            Check browser console (F12) for available tables
                        </div>
                        <div className="text-xs text-gray-400 mt-2">
                            This panel should be visible on the right side
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    
    if (orders.length === 0) {
        return (
            <div 
                className="order-list-panel bg-white rounded-r-lg border-2 border-blue-300" 
                style={{ 
                    width: '250px', 
                    minWidth: '250px',
                    height: '100%', 
                    minHeight: '500px',
                    display: 'flex', 
                    flexDirection: 'column', 
                    flexShrink: 0,
                    backgroundColor: '#ffffff',
                    position: 'relative',
                    zIndex: 10
                }}
            >
                <div className="px-4 py-3 border-b border-gray-200 bg-blue-50 flex-shrink-0">
                    <h3 
                        style={{
                            fontSize: '14px', // Match "Undelegated tasks" size (Normal 12px + 2px)
                            fontWeight: 700,
                            color: '#6b7280',
                            margin: 0
                        }}
                    >
                        This week's Order
                    </h3>
                    <div className="text-xs text-gray-500 mt-1">0 orders</div>
                </div>
                <div className="flex-1 flex items-center justify-center p-4">
                    <div className="text-sm text-blue-600 text-center font-medium">
                        No orders are scheduled for this week.
                    </div>
                </div>
            </div>
        );
    }

    // Try to get Order No field - try common field names (including with period)
    const orderNoField = orderTable.fields.find(field => 
        field.name === 'Order No' || 
        field.name === 'Order No.' ||
        field.name === 'OrderNo' || 
        field.name === 'Order Number' ||
        field.name === 'OrderNumber' ||
        field.name.toLowerCase() === 'order no' ||
        field.name.toLowerCase() === 'order no.' ||
        field.name.toLowerCase().includes('order no')
    );
    
    // Find Fordon field in Orders table
    const fordonField = orderTable.fields?.find(f => 
        f.name === 'Fordon'
    ) || orderTable.fields?.find(f => 
        f.name.toLowerCase() === 'fordon' ||
        f.name.toLowerCase().includes('fordon')
    ) || null;
    
    // Log field search for debugging
    if (!orderNoField) {
        console.log('Order No field not found. Available fields:', orderTable.fields.map(f => f.name));
    } else {
        console.log('Order No field found:', orderNoField.name);
    }

    if (!fordonField) {
        console.log('Fordon field not found. Available fields:', orderTable.fields.map(f => f.name));
    } else {
        console.log('Fordon field found:', fordonField.name);
    }

    // Get order data with sequential number, order number, and Fordon
    const orderData = orders.map((order, index) => {
        let orderNo;
        if (orderNoField) {
            orderNo = order.getCellValueAsString(orderNoField.name) || order.id;
        } else {
            // Fallback: try to get first text field or use record ID
            const textField = orderTable.fields.find(f => f.type === 'singleLineText' || f.type === 'multilineText');
            orderNo = textField ? order.getCellValueAsString(textField.name) : order.id;
        }
        
        // Get Fordon value
        let fordon = '';
        if (fordonField) {
            try {
                fordon = order.getCellValueAsString(fordonField.name) || '';
                if (!fordon) {
                    const fordonValue = order.getCellValue(fordonField.name);
                    if (fordonValue) {
                        fordon = String(fordonValue);
                    }
                }
            } catch (e) {
                console.error('Error getting Fordon for order:', order.id, e);
            }
        }
        
        return { 
            sequentialNumber: index + 1,
            orderNo, 
            fordon: fordon || 'N/A',
            record: order 
        };
    }).filter(item => item.orderNo);

    return (
        <div 
            className="order-list-panel bg-white rounded-r-lg border-2 border-green-300" 
            style={{ 
                width: '250px', 
                minWidth: '250px',
                height: '100%', 
                minHeight: '500px',
                display: 'flex', 
                flexDirection: 'column', 
                flexShrink: 0,
                backgroundColor: '#ffffff',
                position: 'relative',
                zIndex: 10,
                overflow: 'hidden'
            }}
        >
            <div className="px-4 py-3 border-b border-gray-200 bg-green-50 sticky top-0 z-40 flex-shrink-0">
                <h3 
                    style={{
                        fontSize: '14px', // Match "Undelegated tasks" size (Normal 12px + 2px)
                        fontWeight: 700,
                        color: '#6b7280',
                        margin: 0
                    }}
                >
                    This week's Order
                </h3>
                {orderData.length > 0 && (
                    <div className="text-xs text-gray-500 mt-1">{orderData.length} orders</div>
                )}
            </div>
            <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
                {orderData.length > 0 ? (
                    <div className="w-full">
                        {/* Header Row */}
                        <div className="px-4 py-2 border-b-2 border-gray-300 bg-gray-100 sticky top-0 z-30 flex items-center gap-2" style={{ minHeight: '32px' }}>
                            <span className="text-xs font-semibold text-gray-700" style={{ minWidth: '20px' }}>
                                #
                            </span>
                            <span className="text-xs font-semibold text-gray-700 flex-1">
                                Order
                            </span>
                            <span className="text-xs font-semibold text-gray-700" style={{ minWidth: '50px', textAlign: 'right' }}>
                                Fordon
                            </span>
                        </div>
                        {orderData.map(({ sequentialNumber, orderNo, fordon, record }) => {
                            const orderNoTrimmed = orderNo ? orderNo.toString().trim() : '';
                            const isSelected = selectedOrderNumbers.has(orderNoTrimmed);
                            return (
                                <div 
                                    key={record.id}
                                    className={`text-xs px-4 py-2 cursor-pointer border-b border-gray-200 transition-colors flex items-center gap-2 ${
                                        isSelected ? 'bg-blue-100 border-l-4 border-blue-500' : 'text-gray-700 hover:bg-blue-50'
                                    }`}
                                    style={{ 
                                        minHeight: '36px',
                                        borderLeft: isSelected ? '4px solid #3b82f6' : '3px solid transparent'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isSelected) {
                                            e.currentTarget.style.borderLeftColor = '#3b82f6';
                                            e.currentTarget.style.backgroundColor = '#eff6ff';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isSelected) {
                                            e.currentTarget.style.borderLeftColor = 'transparent';
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                        }
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (onOrderClick) {
                                            const orderNoTrimmed = orderNo ? orderNo.toString().trim() : '';
                                            console.log('Order list item clicked:', orderNo, 'trimmed:', orderNoTrimmed);
                                            onOrderClick(orderNoTrimmed, e);
                                        }
                                    }}
                                    title={isSelected ? "Click to deselect" : "Click to view order details (replaces current selection)"}
                                >
                                    <span className={`font-semibold ${isSelected ? 'text-blue-700' : 'text-gray-500'}`} style={{ minWidth: '20px' }}>
                                        {sequentialNumber}.
                                    </span>
                                    <span className={`font-medium flex-1 ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>
                                        {orderNo}
                                    </span>
                                    <span className={`text-xs ${isSelected ? 'text-blue-600' : 'text-gray-500'}`} style={{ minWidth: '50px', textAlign: 'right' }}>
                                        {fordon}
                                    </span>
                                    {isSelected && (
                                        <span className="ml-1 text-blue-600 text-xs">✓</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-sm text-gray-500 p-4 text-center">No order numbers found</div>
                )}
            </div>
        </div>
    );
}

// Droppable Cell Component
function DroppableCell({ mechanicName, date, hourIndex, hourHeight }) {
    // Use the same date format as the calendar headers (MM-DD)
    const dateString = `${date.getMonth() + 1}-${date.getDate()}`;
    const { isOver, setNodeRef } = useDroppable({
        id: `cell-${mechanicName}-${dateString}-${hourIndex}`,
    });

    return (
        <div 
            ref={setNodeRef}
            className={`calendar-cell border-b border-r border-gray-200 relative hover:bg-gray-50 ${isOver ? 'bg-blue-100' : ''}`}
            style={{ height: `${hourHeight}px` }}
        />
    );
}

// Draggable Order Event Component (for order detail panel)
function DraggableOrderEvent({ event, imageUrl, visualization, fordon, mekanikerNames, status, statusIcon, backgroundColor, isUpdating, isRecentlyUpdated, orderNo, orderRecord, onClose, showVisualization = true, isScheduled = false, isDelegated = false, variant = 'top', customUniqueId = null, arbetsorder = '', onHighlightEvent }) {
    // Use useSortable with unique ID that includes both orderNo and event.id
    // Format: "order-detail-{orderNo}-{event.id}" so each event is uniquely identifiable
    const uniqueId = customUniqueId || `order-detail-${orderNo || 'unknown'}-${event.id}`;
    
    // Check if status is "Färdig" - if so, disable dragging
    let isFardig = false;
    try {
        const statusPaTidsmote = event.getCellValue('Status på tidsmöte');
        if (statusPaTidsmote) {
            // Handle both object format {name: "Färdig"} and string format
            const statusName = typeof statusPaTidsmote === 'string' 
                ? statusPaTidsmote 
                : (statusPaTidsmote.name || statusPaTidsmote.value || '');
            isFardig = statusName && statusName.toLowerCase() === 'färdig';
        }
    } catch (e) {
        console.error('Error checking Status på tidsmöte:', e);
    }
    
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ 
        id: uniqueId,
        disabled: isFardig // Disable dragging if status is Färdig
    });

    // Don't render if updating or recently updated
    if (isUpdating || isRecentlyUpdated) {
        return null;
    }

    // For left variant, allow scheduled events to render (but not draggable)
    // For top variant, don't render scheduled events (they use StaticOrderEvent instead)
    const isLeftVariant = variant === 'left';
    const shouldRenderScheduled = isLeftVariant && isScheduled;
    const shouldMakeDraggable = !isScheduled;
    
    // Don't render scheduled events for top variant
    if (isScheduled && !isLeftVariant) {
        return null;
    }

    // For delegated sub orders, make them clickable (pointer cursor) instead of not-allowed
    const cursorStyle = isDelegated ? 'pointer' : (shouldMakeDraggable ? (isDragging ? 'grabbing' : 'grab') : 'not-allowed');
    
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : (isScheduled && isLeftVariant ? 0.7 : 1),
        cursor: cursorStyle,
    };
    const imageSize = isLeftVariant ? 80 : 100;
    const containerStyles = isLeftVariant
        ? {
            border: isDragging ? '2px dashed #3b82f6' : 'none',
            backgroundColor: isDragging ? '#f0f9ff' : 'transparent',
            borderRadius: '0',
            padding: '0',
            width: '100%',
            marginBottom: '4px',
        }
        : {
            border: isDragging ? '2px dashed #3b82f6' : '2px solid transparent',
            backgroundColor: isDragging ? '#f0f9ff' : 'transparent',
            borderRadius: '8px',
            padding: '8px',
        };

    return (
        <div 
            ref={setNodeRef}
            {...(shouldMakeDraggable && !isFardig ? attributes : {})}
            {...(shouldMakeDraggable && !isFardig ? listeners : {})}
            className="flex-shrink-0"
            style={{ 
                ...style,
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: isLeftVariant ? 'flex-start' : 'center',
                border: containerStyles.border,
                borderRadius: containerStyles.borderRadius,
                padding: containerStyles.padding,
                backgroundColor: containerStyles.backgroundColor,
                transition: 'all 0.2s',
                position: 'relative',
                width: isLeftVariant ? '100%' : undefined,
                marginBottom: isLeftVariant ? containerStyles.marginBottom : undefined
            }}
            onClick={(e) => {
                // Only handle click if we're not dragging
                // The drag sensor with 10px activation distance will prevent clicks from triggering drag
                if (!isDragging) {
                    // For delegated sub orders, highlight the related event in calendar
                    if (isDelegated && onHighlightEvent && event) {
                        e.stopPropagation();
                        // Pass event ID and whether it's from left side
                        onHighlightEvent(event.id, isLeftVariant);
                        // Clear highlight after 5 seconds (for left side) or 3 seconds (for top)
                        const timeout = isLeftVariant ? 5000 : 3000;
                        setTimeout(() => {
                            onHighlightEvent(null, false);
                        }, timeout);
                    }
                    // Double click to deselect/close the order detail
                    if (e.detail === 2 && onClose) {
                        e.stopPropagation();
                        onClose();
                    }
                }
            }}
        >
            {isLeftVariant ? (
                // Left variant: Show only title with detail icon on the left (for all sub orders)
                // Undelegated sub orders: gray, Delegated sub orders: red
                <div className="w-full flex items-center gap-2" style={{ position: 'relative' }}>
                    {/* Detail icon - on the left (show for all sub orders) */}
                    <div
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (event) {
                                expandRecord(event);
                            }
                        }}
                        style={{
                            width: '20px',
                            height: '20px',
                            minWidth: '20px',
                            minHeight: '20px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#3b82f6',
                            backgroundColor: '#eff6ff',
                            fontSize: '14px',
                            flexShrink: 0,
                            transition: 'all 0.2s ease',
                            borderRadius: '4px',
                            padding: '4px',
                            border: '1px solid #bfdbfe'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#dbeafe';
                            e.currentTarget.style.color = '#2563eb';
                            e.currentTarget.style.borderColor = '#93c5fd';
                            e.currentTarget.style.transform = 'scale(1.1)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#eff6ff';
                            e.currentTarget.style.color = '#3b82f6';
                            e.currentTarget.style.borderColor = '#bfdbfe';
                            e.currentTarget.style.transform = 'scale(1)';
                        }}
                        title="Click to view details"
                    >
                        <svg 
                            width="14" 
                            height="14" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2.5" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                        >
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="16" x2="12" y2="12"></line>
                            <line x1="12" y1="8" x2="12.01" y2="8"></line>
                        </svg>
                    </div>
                    <div 
                        className="text-xs flex-1" 
                        style={{ 
                            fontWeight: !isScheduled ? '700' : 'normal',
                            color: (isDelegated || isScheduled) ? '#dc2626' : '#6b7280', // Red for delegated, gray for undelegated
                            textAlign: 'left',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            fontSize: !isScheduled ? '13px' : '12px',
                            backgroundColor: 'transparent',
                            padding: '0',
                            borderRadius: '0',
                            borderLeft: 'none'
                        }}
                    >
                        {arbetsorder || 'Untitled'}
                    </div>
                </div>
            ) : (
                // Top variant: Show full details
                <>
                    {/* Image - First line (at the very top) */}
                    {imageUrl ? (
                        <div className="mb-2" style={{ width: `${imageSize}px`, height: `${imageSize}px`, overflow: 'hidden', borderRadius: '4px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                            <img 
                                src={imageUrl} 
                                alt={`Order Event`}
                                style={{ width: `${imageSize}px`, height: `${imageSize}px`, objectFit: 'cover', display: 'block', margin: '0 auto' }}
                            />
                        </div>
                    ) : (
                        <div className="mb-2 text-xs text-gray-400 italic text-center border border-dashed border-gray-300 rounded" style={{ width: `${imageSize}px`, height: `${imageSize}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            No image
                        </div>
                    )}
                    
                    {/* Arbetsorder - Second line */}
                    {/* Undelegated sub orders: gray, Delegated sub orders: red */}
                    {arbetsorder && (
                        <div className="mb-1 text-xs text-center" style={{ fontWeight: '700' }}>
                            <span style={{ color: (isDelegated || isScheduled) ? '#dc2626' : '#6b7280' }}>{arbetsorder}</span>
                        </div>
                    )}
                    
                    {/* Visualization - Third line (only if showVisualization is true) */}
                    {showVisualization && (
                        <div className="mb-1 text-xs text-center">
                            {visualization ? (
                                <span style={{ color: (isDelegated || isScheduled) ? '#dc2626' : '#6b7280' }}>{visualization}</span>
                            ) : (
                                <span className="text-gray-400 italic">Not set</span>
                            )}
                        </div>
                    )}
                    
                    {/* Fordon - Fourth line (from Orders table) */}
                    <div className="mb-1 text-xs text-center">
                        <span className="font-semibold" style={{ color: (isDelegated || isScheduled) ? '#dc2626' : '#6b7280' }}>REG: </span>
                        {fordon ? (
                            <span style={{ color: (isDelegated || isScheduled) ? '#dc2626' : '#6b7280' }}>{fordon}</span>
                        ) : (
                            <span className="text-gray-400 italic">Not set</span>
                        )}
                    </div>
                    
                    {/* Mekaniker - Fifth line */}
                    <div className="mb-1 text-xs text-center">
                        <span className="font-semibold" style={{ color: (isDelegated || isScheduled) ? '#dc2626' : '#6b7280' }}>Namn: </span>
                        {mekanikerNames ? (
                            <span style={{ color: (isDelegated || isScheduled) ? '#dc2626' : '#6b7280' }}>{mekanikerNames}</span>
                        ) : (
                            <span className="text-gray-400 italic">Not set</span>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

// Static (non-draggable) Order Event for already scheduled events
function StaticOrderEvent({ event, imageUrl, visualization, fordon, arbetsorder, mekanikerNames, status, statusIcon, backgroundColor, isUpdating, isRecentlyUpdated, onClose, showVisualization = true, isScheduled = true, isDelegated = false, onHighlightEvent }) {
    if (isUpdating || isRecentlyUpdated) {
        return null;
    }

    // For delegated sub orders, make them clickable
    const cursorStyle = isDelegated ? 'pointer' : 'not-allowed';
    const opacityStyle = isDelegated ? 1 : 0.7;
    
    return (
        <div 
            className="flex-shrink-0"
            style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                borderRadius: '8px',
                padding: '8px',
                backgroundColor: 'transparent',
                opacity: opacityStyle,
                cursor: cursorStyle,
                position: 'relative'
            }}
            onClick={(e) => {
                // For delegated sub orders, highlight the related event in calendar
                // StaticOrderEvent is used in top component, but we check if it's delegated
                if (isDelegated && onHighlightEvent && event) {
                    e.stopPropagation();
                    // StaticOrderEvent is used in top component, so isFromLeft = false
                    onHighlightEvent(event.id, false);
                    // Clear highlight after 3 seconds for top component
                    setTimeout(() => {
                        onHighlightEvent(null, false);
                    }, 3000);
                }
                // Double click to deselect/close the order detail
                if (e.detail === 2 && onClose) {
                    e.stopPropagation();
                    onClose();
                }
            }}
        >
            {imageUrl ? (
                <div className="mb-2" style={{ width: '100px', height: '100px', overflow: 'hidden', borderRadius: '4px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                    <img 
                        src={imageUrl} 
                        alt={`Order Event`}
                        style={{ width: '100px', height: '100px', objectFit: 'cover', display: 'block', margin: '0 auto' }}
                    />
                </div>
            ) : (
                <div className="mb-2 text-xs text-gray-400 italic text-center rounded" style={{ width: '100px', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    No image
                </div>
            )}
            
            {/* Arbetsorder - First line (delegated sub orders should have red text) */}
            {arbetsorder && (
                <div className="mb-1 text-xs text-center" style={{ fontWeight: '700' }}>
                    <span className={isScheduled ? "text-red-600" : "text-gray-500"}>{arbetsorder}</span>
                </div>
            )}
            
            {showVisualization && (
            <div className="mb-1 text-xs text-center">
                {visualization ? (
                        <span className={isScheduled ? "text-red-600" : "text-gray-500"}>{visualization}</span>
                ) : (
                    <span className="text-gray-400 italic">Not set</span>
                )}
            </div>
            )}
            
            <div className="mb-1 text-xs text-center">
                <span className={`font-semibold ${isScheduled ? "text-red-600" : "text-gray-500"}`}>REG: </span>
                {fordon ? (
                    <span className={isScheduled ? "text-red-600" : "text-gray-500"}>{fordon}</span>
                ) : (
                    <span className="text-gray-400 italic">Not set</span>
                )}
            </div>
            
            <div className="mb-1 text-xs text-center">
                <span className={`font-semibold ${isScheduled ? "text-red-600" : "text-gray-500"}`}>Namn: </span>
                {mekanikerNames ? (
                    <span className={isScheduled ? "text-red-600" : "text-gray-500"}>{mekanikerNames}</span>
                ) : (
                    <span className="text-gray-400 italic">Not set</span>
                )}
            </div>
        </div>
    );
}

// Draggable Event Component
function DraggableEvent({ event, top, height, backgroundColor, onExpand, isUpdating, isRecentlyUpdated, status, statusIcon, highlightedEvent, eventsTable, setUpdatingRecords }) {
    const isHighlighted = highlightedEvent && highlightedEvent.eventId === event.id;
    const isFromLeft = highlightedEvent && highlightedEvent.isFromLeft;
    
    // Check if status is "Färdig" - if so, disable dragging and undelegate button
    let isFardig = false;
    try {
        const statusPaTidsmote = event.getCellValue('Status på tidsmöte');
        if (statusPaTidsmote) {
            // Handle both object format {name: "Färdig"} and string format
            const statusName = typeof statusPaTidsmote === 'string' 
                ? statusPaTidsmote 
                : (statusPaTidsmote.name || statusPaTidsmote.value || '');
            isFardig = statusName && statusName.toLowerCase() === 'färdig';
        }
    } catch (e) {
        console.error('Error checking Status på tidsmöte:', e);
    }
    
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ 
        id: `event-${event.id}`,
        disabled: isFardig // Disable dragging if status is Färdig
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : (isUpdating || isRecentlyUpdated ? 0 : 1),
    };

    // Don't render if updating or recently updated
    if (isUpdating || isRecentlyUpdated) {
        return null;
    }

    const eventTitle = event.getCellValueAsString('Arbetsorder beskrivning') || 'Untitled';
    const bookingOrder = event.getCellValueAsString('Boknings-Order') || '';
    
    // Get Assign date field
    let assignDate = null;
    let assignDateStr = '';
    try {
        const assignDateValue = event.getCellValue('Assign date');
        if (assignDateValue) {
            if (assignDateValue instanceof Date) {
                assignDate = assignDateValue;
            } else if (typeof assignDateValue === 'string') {
                assignDate = new Date(assignDateValue);
            }
            
            if (assignDate && !isNaN(assignDate.getTime())) {
                // Format as MM-DD or DD/MM depending on preference
                const month = (assignDate.getMonth() + 1).toString().padStart(2, '0');
                const day = assignDate.getDate().toString().padStart(2, '0');
                assignDateStr = `${month}-${day}`;
            }
        }
    } catch (e) {
        console.error('Error getting Assign date:', e);
    }
    
    // Check if this is a delegated sub order (has both Starttid and Sluttid)
    // Delegated sub orders should have red text color
    // Exclude lunch break events (they're virtual events, not sub orders)
    const isLunchBreak = event.isLunchBreak === true;
    const starttid = event.getCellValue('Starttid');
    const sluttid = event.getCellValue('Sluttid');
    const isDelegated = !!(starttid && sluttid) && !isLunchBreak;
    
    // Handle click on event (show details) - only if not dragging
    // The drag sensor has activationDistance: 10, so clicks (which don't move 10px) won't trigger drag
    const handleEventClick = (e) => {
        // Don't trigger if we're dragging, if it's a lunch break, if status is Färdig, or if click came from the small button
        if (isDragging || isLunchBreak || isFardig || e.target.closest('.undelegate-button')) {
            if (isFardig) {
                // Optionally show a message that the event cannot be opened
                console.log('Event with Färdig status cannot be opened');
            }
            return;
        }
        
        // Show event details
        expandRecord(event);
    };
    
    // Handle undelegation (remove Starttid and Sluttid)
    const handleUndelegate = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!eventsTable || !event || isLunchBreak) {
            return;
        }
        
        if (!isDelegated) {
            console.log('Event is not delegated, cannot undelegate');
            return;
        }
        
        try {
            // Find Starttid and Sluttid fields
            const starttidField = eventsTable.fields.find(f => 
                f.name === 'Starttid' || f.name.toLowerCase() === 'starttid'
            );
            const sluttidField = eventsTable.fields.find(f => 
                f.name === 'Sluttid' || f.name.toLowerCase() === 'sluttid'
            );
            
            if (!starttidField || !sluttidField) {
                console.error('Starttid or Sluttid fields not found');
                return;
            }
            
            // Mark as updating
            if (setUpdatingRecords) {
                setUpdatingRecords(prev => new Set(prev).add(event.id));
            }
            
            // Update record to remove Starttid and Sluttid
            await eventsTable.updateRecordAsync(event.id, {
                [starttidField.name]: null,
                [sluttidField.name]: null,
            });
            
            console.log('Event undelegated successfully:', event.id);
        } catch (error) {
            console.error('Error undelegating event:', error);
            alert('Failed to undelegate event. Please try again.');
        } finally {
            // Remove updating flag after a delay
            if (setUpdatingRecords) {
                setTimeout(() => {
                    setUpdatingRecords(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(event.id);
                        return newSet;
                    });
                }, 500);
            }
        }
    };
    
    // Get Mekaniker value - handle different data structures
    let mechanicName = '';
    try {
        const mekaniker = event.getCellValue('Mekaniker');
        if (mekaniker) {
            if (Array.isArray(mekaniker) && mekaniker.length > 0) {
                // Try to get name/value from first element
                const firstMek = mekaniker[0];
                if (typeof firstMek === 'string') {
                    mechanicName = firstMek;
                } else if (firstMek && firstMek.name) {
                    mechanicName = firstMek.name;
                } else if (firstMek && firstMek.value) {
                    mechanicName = firstMek.value;
                } else if (firstMek) {
                    mechanicName = String(firstMek);
                }
            } else if (typeof mekaniker === 'string') {
                mechanicName = mekaniker;
            }
        }
    } catch (e) {
        console.error('Error getting Mekaniker in DraggableEvent:', e, {
            eventId: event.id,
            errorMessage: e.message
        });
    }

    return (
        <div
            ref={setNodeRef}
            style={{
                ...style,
                position: 'absolute',
                left: '4px',
                right: '4px',
                top: `${top}px`,
                height: `${height}px`,
                backgroundColor,
                borderRadius: '12px',
                boxShadow: isHighlighted 
                    ? (isFromLeft 
                        ? '0 0 0 10px rgba(239, 68, 68, 0.3), 0 4px 8px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)' 
                        : '0 0 0 3px #3b82f6, 0 4px 8px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)')
                    : '0 4px 8px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)',
                border: isHighlighted 
                    ? (isFromLeft ? '10px solid #ef4444' : '2px solid #3b82f6') 
                    : '1px solid rgba(255, 255, 255, 0.3)',
                backdropFilter: 'blur(1px)',
                zIndex: isHighlighted ? 1000 : 'auto',
                transition: 'border 0.5s ease, box-shadow 0.5s ease',
                cursor: isLunchBreak ? 'default' : (isFardig ? 'not-allowed' : 'pointer'),
                opacity: isFardig ? 0.7 : 1,
            }}
            className="event-block text-white transition-all duration-200"
            onClick={handleEventClick}
            onMouseEnter={(e) => {
                if (!isLunchBreak) {
                    e.currentTarget.style.opacity = '0.9';
                }
            }}
            onMouseLeave={(e) => {
                if (!isLunchBreak) {
                    e.currentTarget.style.opacity = '1';
                }
            }}
                {...attributes}
            {...(isFardig ? {} : listeners)} // Only apply listeners if not Färdig
        >
            {/* Event content with modern design */}
            <div style={{ 
                position: 'relative', 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 6px',
                overflow: 'hidden',
                textAlign: 'center'
            }}>
                {/* Event title - bold and prominent */}
                <div style={{
                    fontSize: '12px',
                    fontWeight: '700',
                    marginBottom: '4px',
                    lineHeight: '1.2',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    width: '100%'
                }}>
                    {eventTitle}
                </div>
                
                {/* Booking order */}
                {bookingOrder && (
                    <div style={{
                        fontSize: '10px',
                        fontWeight: '500',
                        marginBottom: '2px',
                        opacity: 0.9,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        width: '100%'
                    }}>
                        {bookingOrder}
                    </div>
                )}
                
                {/* Assign date */}
                {assignDateStr && (
                    <div style={{
                        fontSize: '9px',
                        fontWeight: '400',
                        marginBottom: '2px',
                        opacity: 0.85,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        width: '100%'
                    }}>
                        {assignDateStr}
                    </div>
                )}
                
                {/* Undelegate button (only show for delegated events, but not if status is Färdig) */}
                {isDelegated && !isLunchBreak && !isFardig && (
                    <div
                        className="undelegate-button"
                        style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            width: '18px',
                            height: '18px',
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '600',
                            flexShrink: 0,
                            border: '1.5px solid #6b7280',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
                            zIndex: 1000,
                            color: '#6b7280',
                            lineHeight: '1',
                            transition: 'all 0.15s ease'
                        }}
                        onClick={handleUndelegate}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#6b7280';
                            e.currentTarget.style.color = '#ffffff';
                            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.25)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
                            e.currentTarget.style.color = '#6b7280';
                            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.2)';
                        }}
                        title="Click to undelegate (remove time)"
                    >
                        ×
                    </div>
                )}
            </div>
        </div>
    );
}

function CalendarInterfaceExtension() {
    const base = useBase();
    // Table name is "Calendar Events"
    let eventsTable = null;
    try {
        eventsTable = base.getTableByName('Calendar Events');
        console.log('Found Calendar Events table');
    } catch (e) {
        try {
            eventsTable = base.getTableByName('Calendar Events');
            console.log('Found Calendar Events table (with space)');
        } catch (e2) {
            console.error('CalendarEvents table not found. Available tables:', base.tables.map(t => t.name));
        }
    }
    
    // Always call useRecords hook (required by React rules)
    // If eventsTable is null, we'll use a fallback table but won't use the data
    const eventsRaw = useRecords(eventsTable || base.tables[0] || null);
    const events = eventsTable ? eventsRaw : [];
    
    // Get Orders table - table name is "Orders"
    let orderTable = null;
    try {
        // Try to get the Orders table directly
        orderTable = base.getTableByName('Orders');
        console.log('Orders table found:', orderTable.name);
        console.log('Orders table fields:', orderTable.fields.map(f => f.name));
    } catch (error) {
        // If getTableByName fails, try finding from base.tables
        console.warn('getTableByName failed, trying base.tables:', error);
        orderTable = base.tables.find(table => table.name === 'Orders') || null;
        
        if (orderTable) {
            console.log('Orders table found via base.tables:', orderTable.name);
            console.log('Orders table fields:', orderTable.fields.map(f => f.name));
        } else {
            console.error('Orders table not found!');
            console.log('Available tables:', base.tables.map(t => t.name));
        }
    }
    
    // Always call useRecords hook (required by React rules)
    // If orderTable is null, we'll use eventsTable as fallback but won't use the data
    const orderRecordsRaw = useRecords(orderTable || eventsTable);
    const orderRecords = orderTable ? orderRecordsRaw : [];
    
    // Get Mechanics table
    let mechanicsTable = null;
    try {
        mechanicsTable = base.getTableByName('Mechanics');
        console.log('Mechanics table found:', mechanicsTable.name);
    } catch (error) {
        console.error('Mechanics table not found. Available tables:', base.tables.map(t => t.name));
    }
    
    // Always call useRecords hook (required by React rules)
    const mechanicsRecordsRaw = useRecords(mechanicsTable || eventsTable);
    const mechanicsRecords = mechanicsTable ? mechanicsRecordsRaw : [];
    
    console.log('Order records count:', orderRecords.length);
    console.log('Mechanics records count:', mechanicsRecords.length);
    if (orderTable && orderRecords.length > 0) {
        console.log('Successfully loaded orders from Orders table');
    } else if (orderTable && orderRecords.length === 0) {
        console.warn('Orders table found but has no records');
    }

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [stableMechanicOrder, setStableMechanicOrder] = useState([]);
    const [updatingRecords, setUpdatingRecords] = useState(new Set());
    const [recentlyUpdatedRecords, setRecentlyUpdatedRecords] = useState(new Set());
    // Separate selection states for top and left side panels
    const [topSelectedOrderNumbers, setTopSelectedOrderNumbers] = useState(new Set());
    const [sideSelectedOrderNumbers, setSideSelectedOrderNumbers] = useState(new Set());
    // Highlighted event in calendar (for clicking delegated sub orders)
    // Format: { eventId: string, isFromLeft: boolean }
    const [highlightedEvent, setHighlightedEvent] = useState(null);
    
    // Handler for highlighting events
    const handleHighlightEvent = useCallback((eventId, isFromLeft = false) => {
        if (eventId) {
            setHighlightedEvent({ eventId, isFromLeft });
        } else {
            setHighlightedEvent(null);
        }
    }, []);
    const isInitialMount = useRef(true);
    const isSelectingOrder = useRef(false); // Prevent multiple simultaneous selections

    // Drag and drop sensors - configure to only activate on drag, not click
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 10, // Only activate drag after 10px of movement
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const hourHeight = 50;
    const headerHeight = 48;
    const dateRowHeight = 24;
    const cellWidth = 80;
    const hours = Array.from({ length: 15 }, (_, i) => `${(i + 5).toString().padStart(2, '0')}:00`); // 05:00 to 19:00

    useEffect(() => {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const mondayOffset = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
        const monday = new Date(now);
        monday.setDate(now.getDate() + mondayOffset);
        const friday = new Date(monday);
        friday.setDate(monday.getDate() + 4);

        setStartDate(monday.toISOString().split('T')[0]);
        setEndDate(friday.toISOString().split('T')[0]);
    }, []);

    // Clear selected orders when week changes
    useEffect(() => {
        // Skip clearing on initial mount
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        
        // Clear selection when week changes (only top selection, left side stays independent)
        if (startDate && endDate) {
            setTopSelectedOrderNumbers(new Set());
        }
    }, [startDate, endDate]);

    const goToWeek = (offsetWeeks) => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        start.setDate(start.getDate() + offsetWeeks * 7);
        end.setDate(end.getDate() + offsetWeeks * 7);
        setStartDate(start.toISOString().split('T')[0]);
        setEndDate(end.toISOString().split('T')[0]);
    };

    // Helper function to check if event status is "Färdig"
    const isEventFardig = (eventRecord) => {
        if (!eventRecord) return false;
        try {
            const statusPaTidsmote = eventRecord.getCellValue('Status på tidsmöte');
            if (statusPaTidsmote) {
                // Handle both object format {name: "Färdig"} and string format
                const statusName = typeof statusPaTidsmote === 'string' 
                    ? statusPaTidsmote 
                    : (statusPaTidsmote.name || statusPaTidsmote.value || '');
                return statusName && statusName.toLowerCase() === 'färdig';
            }
        } catch (e) {
            console.error('Error checking Status på tidsmöte:', e);
        }
        return false;
    };

    // Drag and drop handler
    const handleDragEnd = async (event) => {
        const { active, over } = event;
        
        console.log('Drag end:', { active: active.id, over: over?.id });
        
        if (!over || active.id === over.id) {
            console.log('No valid drop target or same position');
            return;
        }

        try {
            // Parse the active and over IDs to get record and target info
            const activeId = active.id;
            const overId = over.id;
            
            console.log('Parsing IDs:', { activeId, overId });
            
            // Handle calendar event being dragged back to order detail panels
            const orderDetailDropPrefixes = [
                'order-detail-drop-',
                'left-order-detail-drop-',
                'order-detail-',
                'left-order-detail-'
            ];
            
            if (activeId.startsWith('event-')) {
                // Check if dropped on the entire left side panel
                if (overId === 'left-side-panel-drop') {
                    if (!eventsTable || !orderTable) {
                        console.warn('Events table or order table not available, cannot unschedule event');
                        return;
                    }
                    
                    const eventRecordId = activeId.replace('event-', '');
                    const eventRecord = events.find(ev => ev.id === eventRecordId);
                    if (!eventRecord) {
                        console.error('Could not find event record for unscheduling:', eventRecordId);
                        return;
                    }
                    
                    // Check if status is "Färdig" - if so, prevent moving
                    if (isEventFardig(eventRecord)) {
                        console.log('Cannot move event with Färdig status');
                        alert('Cannot move event: Event status is "Färdig". Events with this status cannot be moved.');
                        return;
                    }
                    
                    // Find which order this event belongs to by checking the event's Order field
                    const orderField = eventsTable.fields.find(field => field.name === 'Order');
                    if (!orderField) {
                        console.error('Order field not found in Calendar Events table');
                        return;
                    }
                    
                    const eventOrderValue = eventRecord.getCellValue(orderField.name);
                    let targetOrderRecord = null;
                    
                    if (Array.isArray(eventOrderValue) && eventOrderValue.length > 0) {
                        // If Order field is a linked record, find the matching order
                        const linkedOrderId = eventOrderValue[0].id;
                        targetOrderRecord = orderRecords.find(order => order.id === linkedOrderId);
                    } else if (eventOrderValue) {
                        // If Order field is a text field with order number
                        const orderNoField = orderTable.fields.find(field => 
                            field.name === 'Order No' || 
                            field.name === 'Order No.' ||
                            field.name.toLowerCase().includes('order no')
                        );
                        if (orderNoField) {
                            const eventOrderNo = eventOrderValue.toString().trim();
                            targetOrderRecord = orderRecords.find(order => {
                                const orderNo = order.getCellValueAsString(orderNoField.name);
                                return orderNo && orderNo.toString().trim() === eventOrderNo;
                            });
                        }
                    }
                    
                    if (!targetOrderRecord) {
                        console.warn('Could not find matching order for event. Event will still be unscheduled.');
                    }
                    
                    console.log('Unscheduling event from calendar (dropped on panel):', {
                        eventRecordId,
                        targetOrderRecord: targetOrderRecord?.id
                    });
                    
                    if (!eventsTable.hasPermissionToUpdateRecords([eventRecord])) {
                        console.warn('No permission to update event record when unscheduling');
                        alert('Cannot update event: Record editing is not enabled. Please contact your base administrator.');
                        return;
                    }
                    
                    const updates = {
                        'Starttid': null,
                        'Sluttid': null
                    };
                    
                    const mekanikerField = eventsTable.fields.find(field => 
                        field.name === 'Mekaniker' || 
                        field.name.toLowerCase() === 'mekaniker'
                    );
                    if (mekanikerField) {
                        updates[mekanikerField.name] = [];
                    }
                    
                    const statusPaTidsmoteField = eventsTable.fields.find(field => 
                        field.name === 'Status på tidsmöte' ||
                        field.name.toLowerCase() === 'status på tidsmöte' ||
                        field.name.toLowerCase().includes('tidsmöte')
                    );
                    if (statusPaTidsmoteField) {
                        updates[statusPaTidsmoteField.name] = null;
                    }
                    
                    setUpdatingRecords(prev => new Set(prev).add(eventRecordId));
                    
                    try {
                        await eventsTable.updateRecordAsync(eventRecord, updates);
                        setRecentlyUpdatedRecords(prev => new Set(prev).add(eventRecordId));
                        setTimeout(() => {
                            setRecentlyUpdatedRecords(prev => {
                                const newSet = new Set(prev);
                                newSet.delete(eventRecordId);
                                return newSet;
                            });
                        }, 1000);
                    } catch (error) {
                        console.error('Error unscheduling event:', error);
                        alert('Error updating event: ' + error.message);
                    } finally {
                        setUpdatingRecords(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(eventRecordId);
                            return newSet;
                        });
                    }
                    
                    return;
                }
                
                // Check if dropped on a specific order card
                const targetDropPrefix = orderDetailDropPrefixes.find(prefix => overId.startsWith(prefix));
                if (targetDropPrefix) {
                    if (!eventsTable) {
                        console.warn('Events table not available, cannot unschedule event');
                        return;
                    }
                    
                    const eventRecordId = activeId.replace('event-', '');
                    const eventRecord = events.find(ev => ev.id === eventRecordId);
                    if (!eventRecord) {
                        console.error('Could not find event record for unscheduling:', eventRecordId);
                        return;
                    }
                    
                    // Check if status is "Färdig" - if so, prevent moving
                    if (isEventFardig(eventRecord)) {
                        console.log('Cannot move event with Färdig status');
                        alert('Cannot move event: Event status is "Färdig". Events with this status cannot be moved.');
                        return;
                    }
                    
                    let targetOrderNo = '';
                    const afterPrefix = overId.substring(targetDropPrefix.length);
                    if (targetDropPrefix === 'order-detail-' || targetDropPrefix === 'left-order-detail-') {
                        const lastDashIndex = afterPrefix.lastIndexOf('-');
                        targetOrderNo = lastDashIndex > 0 ? afterPrefix.substring(0, lastDashIndex) : afterPrefix;
                    } else {
                        targetOrderNo = afterPrefix;
                    }
                    
                    console.log('Unscheduling event from calendar:', {
                        eventRecordId,
                        targetOrderNo,
                        overId
                    });
                    
                    if (!eventsTable.hasPermissionToUpdateRecords([eventRecord])) {
                        console.warn('No permission to update event record when unscheduling');
                        alert('Cannot update event: Record editing is not enabled. Please contact your base administrator.');
                        return;
                    }
                    
                    const updates = {
                        'Starttid': null,
                        'Sluttid': null
                    };
                    
                    const mekanikerField = eventsTable.fields.find(field => 
                        field.name === 'Mekaniker' || 
                        field.name.toLowerCase() === 'mekaniker'
                    );
                    if (mekanikerField) {
                        updates[mekanikerField.name] = [];
                    }
                    
                    const statusPaTidsmoteField = eventsTable.fields.find(field => 
                        field.name === 'Status på tidsmöte' ||
                        field.name.toLowerCase() === 'status på tidsmöte' ||
                        field.name.toLowerCase().includes('tidsmöte')
                    );
                    if (statusPaTidsmoteField) {
                        updates[statusPaTidsmoteField.name] = null;
                    }
                    
                    setUpdatingRecords(prev => new Set(prev).add(eventRecordId));
                    
                    try {
                        await eventsTable.updateRecordAsync(eventRecord, updates);
                        setRecentlyUpdatedRecords(prev => new Set(prev).add(eventRecordId));
                        setTimeout(() => {
                            setRecentlyUpdatedRecords(prev => {
                                const newSet = new Set(prev);
                                newSet.delete(eventRecordId);
                                return newSet;
                            });
                        }, 1000);
                    } catch (error) {
                        console.error('Error unscheduling event:', error);
                        alert('Error updating event: ' + error.message);
                    } finally {
                        setUpdatingRecords(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(eventRecordId);
                            return newSet;
                        });
                    }
                    
                    return;
                }
            }
            
            // Handle order detail being dragged to calendar cell
            const draggablePrefixes = ['order-detail-', 'left-order-detail-'];
            const matchedPrefix = draggablePrefixes.find(prefix => activeId.startsWith(prefix));

            if (matchedPrefix && overId.startsWith('cell-')) {
                // Extract order number and event ID from ID format: "{prefix}{orderNo}-{eventId}"
                // We need to split on '-' but orderNo itself might contain dashes
                const afterPrefix = activeId.substring(matchedPrefix.length);
                
                // Find the last occurrence of '-' which should separate orderNo from eventId
                // Event IDs are typically long alphanumeric strings, so we'll look for the pattern
                let orderNo = '';
                let sourceEventId = '';
                
                // Try to find where the event ID starts (it's usually a long string at the end)
                // Event IDs in Airtable are typically like "recXXXXXXXXXXXXXX"
                const lastDashIndex = afterPrefix.lastIndexOf('-');
                if (lastDashIndex > 0) {
                    // Everything before the last dash is the order number
                    orderNo = afterPrefix.substring(0, lastDashIndex);
                    // Everything after the last dash is the event ID
                    sourceEventId = afterPrefix.substring(lastDashIndex + 1);
                } else {
                    // Fallback: if no dash found, treat everything as orderNo
                    orderNo = afterPrefix;
                }
                
                // Parse target cell info
                const parts = overId.split('-');
                if (parts.length < 5) {
                    console.error('Invalid cell ID format:', overId);
                    return;
                }
                const mechanicName = parts[1];
                const dateString = `${parts[2]}-${parts[3]}`; // MM-DD format
                const hourIndex = parseInt(parts[4]);
                
                console.log('Order detail dropped:', { 
                    activeId, 
                    orderNo, 
                    sourceEventId, 
                    mechanicName, 
                    dateString, 
                    hourIndex,
                    afterPrefix
                });
                
                // Find the order record
                const orderNoField = orderTable?.fields?.find(field => 
                    field.name === 'Order No' || 
                    field.name === 'Order No.' ||
                    field.name.toLowerCase().includes('order no')
                );
                
                if (!orderNoField || !orderTable || !eventsTable) {
                    console.error('Required fields or tables not found');
                    return;
                }
                
                const orderRecord = orderRecords.find(order => {
                    try {
                        const orderNoValue = order.getCellValueAsString(orderNoField.name);
                        return orderNoValue && orderNoValue.toString().trim() === orderNo.toString().trim();
                    } catch (e) {
                        return false;
                    }
                });
                
                if (!orderRecord) {
                    console.error('Order not found:', orderNo);
                    return;
                }
                
                // Get the source event if it exists
                const sourceEvent = sourceEventId ? events.find(ev => ev.id === sourceEventId) : null;
                
                // Check if source event has "Färdig" status - if so, prevent moving
                if (sourceEvent && isEventFardig(sourceEvent)) {
                    console.log('Cannot move event with Färdig status');
                    alert('Cannot move event: Event status is "Färdig". Events with this status cannot be moved.');
                    return;
                }
                
                // Convert MM-DD format to proper date
                const [month, day] = dateString.split('-').map(Number);
                const matchingDate = displayedDates.find(d => 
                    d.getMonth() + 1 === month && d.getDate() === day
                );
                
                if (!matchingDate) {
                    console.error('Could not find matching date in displayed dates');
                    return;
                }
                
                // Calculate start and end times
                const targetDate = new Date(matchingDate);
                const newStartTime = new Date(targetDate);
                newStartTime.setHours(hourIndex + 5, 0, 0, 0); // Convert from 0-14 hour index to actual hour (05:00-19:00)
                
                // Find existing event for this order (don't create new one)
                const orderField = eventsTable.fields.find(field => 
                    field.name === 'Order' || 
                    field.name.toLowerCase() === 'order'
                );
                
                // Find existing event that matches this order
                let existingEvent = null;
                if (sourceEventId) {
                    // Use the source event if provided
                    existingEvent = events.find(ev => ev.id === sourceEventId);
                } else if (orderField && orderRecord) {
                    // Find any existing event for this order
                    existingEvent = events.find(ev => {
                        const eventOrderValue = ev.getCellValue(orderField.name);
                        if (!eventOrderValue) return false;
                        if (Array.isArray(eventOrderValue)) {
                            return eventOrderValue.some(linkedRecord => linkedRecord.id === orderRecord.id);
                        }
                        return false;
                    });
                }
                
                if (!existingEvent) {
                    console.error('No existing event found for order:', orderNo);
                    alert('No existing event found for this order. Please create an event first.');
                    return;
                }
                
                // Check if this is an undelegated sub order (black colored - no Starttid/Sluttid)
                const currentStarttid = existingEvent.getCellValue('Starttid');
                const currentSluttid = existingEvent.getCellValue('Sluttid');
                const isUndelegated = !currentStarttid || !currentSluttid;
                
                // Calculate start and end times
                // Default duration for undelegated sub orders is 1 hour
                const defaultDuration = 60 * 60 * 1000; // 1 hour in milliseconds
                const newEndTime = new Date(newStartTime.getTime() + defaultDuration);
                
                // If this is an undelegated sub order, check for lunch/break overlaps
                if (isUndelegated) {
                    console.log('Checking lunch/break overlap for undelegated sub order:', {
                        mechanic: mechanicName,
                        date: targetDate.toDateString(),
                        proposedStart: newStartTime.toTimeString(),
                        proposedEnd: newEndTime.toTimeString(),
                        duration: '1 hour'
                    });
                    
                    const lunchBreakEvents = getLunchBreakEventsForMechanicAndDate(mechanicName, targetDate);
                    
                    // Check if the new time slot (1 hour duration) overlaps with any lunch/break event
                    const hasOverlap = lunchBreakEvents.some(lunchEvent => {
                        const lunchStart = new Date(lunchEvent.getCellValue('Starttid'));
                        const lunchEnd = new Date(lunchEvent.getCellValue('Sluttid'));
                        const lunchName = lunchEvent.getCellValueAsString('Arbetsorder beskrivning') || 'Lunch/Coffee Break';
                        
                        // Check if time ranges overlap
                        // Two time ranges overlap if: start1 < end2 && start2 < end1
                        // newStartTime to newEndTime (1 hour) vs lunchStart to lunchEnd
                        const overlaps = newStartTime < lunchEnd && lunchStart < newEndTime;
                        
                        if (overlaps) {
                            console.warn(`⚠️ Time slot overlaps with lunch/break:`, {
                                lunchName,
                                lunchTime: `${lunchStart.toTimeString()} - ${lunchEnd.toTimeString()}`,
                                proposedTime: `${newStartTime.toTimeString()} - ${newEndTime.toTimeString()}`,
                                overlap: true
                            });
                        }
                        
                        return overlaps;
                    });
                    
                    if (hasOverlap) {
                        alert('Cannot assign undelegated sub order: The selected time slot overlaps with a lunch/break period. Please choose a different time.');
                        console.log('Assignment blocked due to lunch/break overlap');
                        return;
                    }
                    
                    console.log('✓ No lunch/break overlap - assignment allowed');
                }
                
                console.log('Updating existing event:', {
                    eventId: existingEvent.id,
                    orderNo,
                    mechanicName,
                    newStartTime: newStartTime.toISOString(),
                    newEndTime: newEndTime.toISOString()
                });
                
                // Check permissions
                if (!eventsTable.hasPermissionToUpdateRecords([existingEvent])) {
                    console.warn('No permission to update records. Please enable record editing in Airtable base settings.');
                    alert('Cannot update event: Record editing is not enabled. Please contact your base administrator.');
                    return;
                }
                
                // Prepare update fields
                const updateFields = {
                    'Starttid': newStartTime,
                    'Sluttid': newEndTime
                };
                
                // Update mechanic
                const mekanikerField = eventsTable.fields.find(field => 
                    field.name === 'Mekaniker' || 
                    field.name.toLowerCase() === 'mekaniker'
                );
                if (mekanikerField) {
                    const mechanicId = mechanicNameToId[mechanicName];
                    if (mechanicId) {
                        updateFields[mekanikerField.name] = [{ id: mechanicId }];
                        console.log('Updating mechanic to:', mechanicId);
                    } else {
                        // Fallback: try to use name
                        updateFields[mekanikerField.name] = [{ name: mechanicName }];
                        console.log('Updating mechanic by name:', mechanicName);
                    }
                }
                
                // Update "Status på tidsmöte" field in Calendar Events table
                const statusPaTidsmoteField = eventsTable.fields.find(field => 
                    field.name === 'Status på tidsmöte' ||
                    field.name.toLowerCase() === 'status på tidsmöte' ||
                    field.name.toLowerCase().includes('tidsmöte')
                );
                
                if (statusPaTidsmoteField) {
                    // For Single select fields, we need to pass an object with 'name' or 'id' property
                    // Check if field has options and find the matching option
                    let planeradValue = null;
                    
                    if (statusPaTidsmoteField.options && statusPaTidsmoteField.options.choices) {
                        // Find the exact option that matches "Planerad" (case-insensitive)
                        const matchingOption = statusPaTidsmoteField.options.choices.find(choice => 
                            choice.name && choice.name.toLowerCase() === 'planerad'
                        );
                        
                        if (matchingOption) {
                            // For Single select, use object with 'name' property
                            planeradValue = { name: matchingOption.name };
                            console.log('Found matching option for Planerad:', matchingOption.name);
                        } else {
                            // Log available options to help debug
                            console.warn('Planerad option not found. Available options:', 
                                statusPaTidsmoteField.options.choices.map(c => c.name)
                            );
                        }
                    } else {
                        // If options not available, try with name object
                        planeradValue = { name: 'Planerad' };
                        console.log('Using Planerad as fallback (options not available)');
                    }
                    
                    if (planeradValue) {
                        updateFields[statusPaTidsmoteField.name] = planeradValue;
                        console.log('Setting Status på tidsmöte to:', planeradValue);
                    }
                } else {
                    console.warn('Status på tidsmöte field not found in Calendar Events table');
                }
                
                // Update Order Status to "Offertförfrågan skickad"
                // Since Order Status is a lookup field, we need to update the Status field in the Orders table
                if (orderTable && orderRecord) {
                    // Find Status field
                    const statusField = orderTable.fields.find(field => 
                        field.name === 'Status' || 
                        field.name === 'Order Status' ||
                        field.name.toLowerCase() === 'status' ||
                        field.name.toLowerCase().includes('status')
                    );
                    
                    if (statusField) {
                        if (orderTable.hasPermissionToUpdateRecords([orderRecord])) {
                            try {
                                await orderTable.updateRecordAsync(orderRecord, {
                                    [statusField.name]: 'Offertförfrågan skickad'
                                });
                                console.log('Order Status updated to: Offertförfrågan skickad');
                            } catch (error) {
                                console.error('Error updating Order Status:', error);
                                // Don't fail the whole operation if status update fails
                            }
                        }
                    }
                }
                
                console.log('Updating record with fields:', updateFields);
                
                try {
                    // Update the existing record
                    await eventsTable.updateRecordAsync(existingEvent, updateFields);
                    console.log('Calendar event updated successfully:', existingEvent.id);
                } catch (error) {
                    console.error('Error updating calendar event:', error);
                    console.error('Error details:', {
                        message: error.message,
                        fields: updateFields,
                        eventId: existingEvent.id,
                        orderNo,
                        mechanicName
                    });
                    alert('Error updating calendar event: ' + error.message);
                }
                
                return;
            }
            
            // Extract information from IDs (format: "event-{recordId}" and "cell-{mechanicName}-{dateString}-{hourIndex}")
            if (activeId.startsWith('event-') && overId.startsWith('cell-')) {
                const recordId = activeId.replace('event-', '');
                const parts = overId.split('-');
                const mechanicName = parts[1];
                const dateString = `${parts[2]}-${parts[3]}`; // MM-DD format
                const hourIndex = parts[4];
                
                console.log('Parsed values:', { recordId, mechanicName, dateString, hourIndex });
                
                // Find the record
                const record = events.find(ev => ev.id === recordId);
                if (!record) {
                    console.log('Record not found:', recordId);
                    return;
                }
                
                // Check if status is "Färdig" - if so, prevent moving
                if (isEventFardig(record)) {
                    console.log('Cannot move event with Färdig status');
                    alert('Cannot move event: Event status is "Färdig". Events with this status cannot be moved.');
                    return;
                }
                
                console.log('Found record:', record);
                
                // Convert MM-DD format to proper date using the displayed dates
                const [month, day] = dateString.split('-').map(Number);
                
                // Find the matching date from displayedDates to get the correct year
                const matchingDate = displayedDates.find(d => 
                    d.getMonth() + 1 === month && d.getDate() === day
                );
                
                if (!matchingDate) {
                    console.log('Could not find matching date in displayed dates');
                    return;
                }
                
                const targetDate = new Date(matchingDate);
                const targetHour = parseInt(hourIndex);
                const newStartTime = new Date(targetDate);
                // Convert from 0-14 hour index back to actual hour (05:00-19:00)
                newStartTime.setHours(targetHour + 5, 0, 0, 0);
                
                console.log('Date calculation:', {
                    dateString,
                    targetDate: targetDate.toISOString(),
                    targetHour,
                    newStartTime: newStartTime.toISOString(),
                    newStartTimeLocal: newStartTime.toString()
                });
                
                // Calculate new end time (keep same duration)
                const oldStartTime = new Date(record.getCellValue('Starttid'));
                const oldEndTime = new Date(record.getCellValue('Sluttid'));
                const duration = oldEndTime - oldStartTime;
                const newEndTime = new Date(newStartTime.getTime() + duration);
                
                console.log('Time comparison:', {
                    oldStartTime: oldStartTime.toISOString(),
                    oldEndTime: oldEndTime.toISOString(),
                    duration: duration / (1000 * 60 * 60), // duration in hours
                    newStartTime: newStartTime.toISOString(),
                    newEndTime: newEndTime.toISOString()
                });
                
                // Update mechanic if different
                const currentMechanic = record.getCellValue('Mekaniker')?.[0]?.value;
                const updates = {
                    'Starttid': newStartTime,
                    'Sluttid': newEndTime
                };
                
                if (currentMechanic !== mechanicName) {
                    console.log('Attempting to update mechanic from', currentMechanic, 'to', mechanicName);
                    
                    // Try to update the "Mekaniker" field specifically
                    try {
                        const mekanikerField = eventsTable.getFieldByName('Mekaniker');
                        if (mekanikerField) {
                            console.log('Found Mekaniker field:', mekanikerField.name, 'Type:', mekanikerField.type);
                            
                            // Check if we have permission to update this field
                            if (eventsTable.hasPermissionToUpdateRecords([record], [{ fields: { [mekanikerField.id]: true } }])) {
                                console.log('Mekaniker field is updatable, attempting to link mechanic...');
                                
                                // Use existing mechanic record ID if available
                                const mechanicId = mechanicNameToId[mechanicName];
                                if (mechanicId) {
                                    updates['Mekaniker'] = [{ id: mechanicId }];
                                    console.log('Updated Mekaniker field with existing mechanic ID:', mechanicId, 'for mechanic:', mechanicName);
                                } else {
                                    console.warn('No existing record ID found for mechanic:', mechanicName);
                                    console.log('Available mechanic IDs:', mechanicNameToId);
                                    // Fallback to using name (this might create a new record)
                                    updates['Mekaniker'] = [{ name: mechanicName }];
                                    console.log('Using name as fallback (may create new record):', mechanicName);
                                }
                            } else {
                                console.log('No permission to update Mekaniker field');
                            }
                        } else {
                            console.log('Mekaniker field not found in Calendar Events table');
                        }
                    } catch (error) {
                        console.log('Error accessing Mekaniker field:', error.message);
                    }
                }
                
                console.log('Updating record with:', updates);
                
                // Add record to updating set to prevent visual glitch
                setUpdatingRecords(prev => new Set([...prev, recordId]));
                
                // Check if we have permission to update records
                if (!eventsTable.hasPermissionToUpdateRecords([record])) {
                    console.warn('No permission to update records. Please enable record editing in Airtable base settings.');
                    alert('Cannot update records: Record editing is not enabled for this table. Please contact your base administrator to enable record editing permissions.');
                    setUpdatingRecords(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(recordId);
                        return newSet;
                    });
                    return;
                }
                
                try {
                    // Update the record
                    await eventsTable.updateRecordAsync(record, updates);
                    console.log('Record updated successfully');
                    
                    // Add to recently updated records to prevent immediate re-render glitch
                    setRecentlyUpdatedRecords(prev => new Set([...prev, recordId]));
                    
                    // Remove from updating set
                    setUpdatingRecords(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(recordId);
                        return newSet;
                    });
                    
                    // Clear from recently updated after a delay to allow data to refresh
                    setTimeout(() => {
                        setRecentlyUpdatedRecords(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(recordId);
                            return newSet;
                        });
                    }, 1000); // 1 second delay
                    
                } catch (error) {
                    // Remove from updating set on error too
                    setUpdatingRecords(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(recordId);
                        return newSet;
                    });
                    throw error;
                }
            } else {
                console.log('Invalid drag/drop combination:', { activeId, overId });
            }
        } catch (error) {
            console.error('Error updating record:', error);
        }
    };

    // Build mechanic profiles and collect existing mechanic record IDs
    const mechanicProfiles = {};
    const mechanicNameToId = {}; // Map mechanic names to their record IDs
    const currentMechanicOrder = []; // Current order from events
    
    // First, build a map of mechanic names to their profile images from Mechanics table
    const mechanicsProfileMap = {};
    if (mechanicsTable && mechanicsRecords.length > 0) {
        // Find the name field in Mechanics table (could be "Name", "Mechanic Name", etc.)
        const nameField = mechanicsTable.fields.find(f => 
            f.name === 'Name' || 
            f.name === 'Mechanic Name' ||
            f.name.toLowerCase().includes('name')
        );
        
        // Find the Profile field
        const profileField = mechanicsTable.fields.find(f => 
            f.name === 'Profile'
        );
        
        // Find the Priority field
        const priorityField = mechanicsTable.fields.find(f => 
            f.name === 'Priority' || 
            f.name.toLowerCase() === 'priority'
        );
        
        if (nameField) {
            mechanicsRecords.forEach(mechRecord => {
                const mechName = mechRecord.getCellValueAsString(nameField.name);
                if (mechName) {
                    try {
                        let profileUrl = null;
                        if (profileField) {
                            const profile = mechRecord.getCellValue(profileField.name);
                            
                            if (profile && Array.isArray(profile) && profile.length > 0) {
                                // Get the first attachment URL
                                const attachment = profile[0];
                                profileUrl = attachment.url || 
                                            attachment.thumbnails?.large?.url || 
                                            attachment.thumbnails?.small?.url;
                            }
                        }
                        
                        // Get Priority value
                        let priority = null;
                        if (priorityField) {
                            try {
                                const priorityValue = mechRecord.getCellValue(priorityField.name);
                                if (priorityValue !== null && priorityValue !== undefined) {
                                    priority = priorityValue;
                                }
                            } catch (e) {
                                console.error('Error getting Priority for mechanic:', mechName, e);
                            }
                        }
                        
                        mechanicsProfileMap[mechName] = {
                            profileUrl: profileUrl,
                            priority: priority
                        };
                        console.log('Found profile and priority for mechanic:', mechName, 'URL:', profileUrl, 'Priority:', priority);
                    } catch (e) {
                        console.error('Error getting Profile for mechanic:', mechName, e);
                    }
                }
            });
        } else {
            console.warn('Name field not found in Mechanics table. Available fields:', 
                mechanicsTable.fields.map(f => f.name));
        }
    }
    
    // Extract mechanics consistently from all events
    events.forEach(ev => {
        const mekaniker = ev.getCellValue('Mekaniker') || [];
        if (Array.isArray(mekaniker) && mekaniker.length > 0) {
            mekaniker.forEach((m, i) => {
                // Get mechanic name - try name first, then value, then string conversion
                let mechName = '';
                if (typeof m === 'string') {
                    mechName = m;
                } else if (m && m.name) {
                    mechName = m.name;
                } else if (m && m.value) {
                    mechName = m.value;
                } else if (m) {
                    mechName = String(m);
                }
                
                // Get mechanic ID if available
                const mechId = (m && m.id) ? m.id : null;
                
                // Only process if we have a valid name (not empty, not undefined, not null)
                if (mechName && mechName.trim() !== '' && mechName !== 'undefined' && mechName !== 'null') {
                    // Store the mapping of name to ID
                    if (mechId) {
                        mechanicNameToId[mechName] = mechId;
                    }
                    
                    // Add to mechanic profiles if not already added
                    if (!mechanicProfiles[mechName]) {
                        // Get profile URL and priority from Mechanics table if available
                        const mechanicData = mechanicsProfileMap[mechName];
                        const profileUrl = mechanicData?.profileUrl || null;
                        const priority = mechanicData?.priority || null;
                        
                        mechanicProfiles[mechName] = {
                            name: mechName,
                            profileUrl: profileUrl,
                            priority: priority
                        };
                        if (!currentMechanicOrder.includes(mechName)) {
                            currentMechanicOrder.push(mechName);
                        }
                    }
                } else {
                    console.log('Skipping invalid mechanic name:', mechName, 'from event:', ev.id);
                }
            });
        }
    });
    
    console.log('Mechanic profiles:', mechanicProfiles);
    console.log('Mechanic name to ID mapping:', mechanicNameToId);
    console.log('Current mechanic order:', currentMechanicOrder);
    
    // Clean currentMechanicOrder to remove any invalid mechanic names
    const cleanedCurrentMechanicOrder = currentMechanicOrder.filter(name => 
        name && name.trim() !== '' && name !== 'undefined' && name !== 'null' && mechanicProfiles[name]
    );
    
    // Clean stableMechanicOrder if it exists
    const cleanedStableMechanicOrder = stableMechanicOrder.filter(name => 
        name && name.trim() !== '' && name !== 'undefined' && name !== 'null' && mechanicProfiles[name]
    );
    
    // Set stable order only once, or if it's empty, and only if we have valid mechanics
    if (cleanedStableMechanicOrder.length === 0 && cleanedCurrentMechanicOrder.length > 0) {
        setStableMechanicOrder(cleanedCurrentMechanicOrder);
        console.log('Setting initial mechanic order:', cleanedCurrentMechanicOrder);
    } else if (cleanedStableMechanicOrder.length > 0 && stableMechanicOrder.length !== cleanedStableMechanicOrder.length) {
        // Update stable order if it had invalid entries
        setStableMechanicOrder(cleanedStableMechanicOrder);
        console.log('Cleaned stable mechanic order:', cleanedStableMechanicOrder);
    }
    
    // Use stable order if available, otherwise use current order
    const orderToUse = cleanedStableMechanicOrder.length > 0 ? cleanedStableMechanicOrder : cleanedCurrentMechanicOrder;
    // Filter out any undefined/null mechanics and only include valid ones
    const mechanics = orderToUse
        .map(name => mechanicProfiles[name])
        .filter(mech => mech && mech.name && mech.name.trim() !== '' && mech.name !== 'undefined');
    
    // Debug: Log mechanic order to help troubleshoot
    console.log('Stable order:', stableMechanicOrder);
    console.log('Current order:', currentMechanicOrder);
    console.log('Using order:', orderToUse);
    console.log('Mechanics array:', mechanics.map(m => m.name));

    const getDisplayedDates = () => {
        if (!startDate || !endDate) return [];
        
        // Always calculate a proper Monday-Friday week based on startDate
        const start = new Date(startDate);
        const dayOfWeek = start.getDay();
        const mondayOffset = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
        const monday = new Date(start);
        monday.setDate(start.getDate() + mondayOffset);
        
        const dates = [];
        for (let i = 0; i < 5; i++) {
            const date = new Date(monday);
            date.setDate(monday.getDate() + i);
            dates.push(date);
        }
        return dates;
    };

    const displayedDates = getDisplayedDates();

    const formatShortDate = date => `${date.getMonth() + 1}-${date.getDate()}`;

    // Filter orders to only show those with at least one scheduled event in displayed week
    const getOrdersWithIngetStatus = (orders) => {
        if (!orders || orders.length === 0) {
            return orders || [];
        }

        // Find the Order field in Calendar Events table
        const orderField = eventsTable?.fields?.find(field => 
            field.name === 'Order'
        );

        // Get Order No field from Orders table
        const orderNoField = orderTable?.fields?.find(field => 
            field.name === 'Order No' || 
            field.name === 'Order No.' ||
            field.name.toLowerCase().includes('order no')
        );

        // Find Starttid and Sluttid fields in Calendar Events table
        const starttidField = eventsTable?.fields?.find(field => 
            field.name === 'Starttid' || 
            field.name.toLowerCase() === 'starttid'
        );
        const sluttidField = eventsTable?.fields?.find(field => 
            field.name === 'Sluttid' || 
            field.name.toLowerCase() === 'sluttid'
        );

        // Check if order has scheduled event in displayed week (no status filter)
        if (!orderField || !starttidField || !sluttidField || !events || events.length === 0 || displayedDates.length === 0) {
            if (!starttidField || !sluttidField) {
                console.warn('Starttid or Sluttid fields not found in Calendar Events table:', {
                    starttidField: starttidField?.name || 'NOT FOUND',
                    sluttidField: sluttidField?.name || 'NOT FOUND',
                    availableFields: eventsTable?.fields?.map(f => f.name) || []
                });
            }
            return [];
        }

        const ordersWithScheduledEvents = orders.filter(order => {
            try {
                // Get order number for matching
                const orderNo = orderNoField ? order.getCellValueAsString(orderNoField.name) : order.id;
                const orderNoTrimmed = orderNo ? orderNo.toString().trim() : '';
                
                // Find events linked to this order
                const matchingEvents = events.filter(event => {
                    const eventOrderValue = event.getCellValue(orderField.name);
                    if (!eventOrderValue) return false;
                    
                    // Handle linked records (array) - when Order field links to Orders table
                    if (Array.isArray(eventOrderValue)) {
                        return eventOrderValue.some(linkedRecord => linkedRecord.id === order.id);
                    }
                    
                    // Handle direct value (if Order field is a text field with order number)
                    const eventOrderNo = eventOrderValue.toString().trim();
                    return eventOrderNo === orderNoTrimmed;
                });
                
                // Check if any matching event is scheduled in the displayed week
                const hasScheduledEventInWeek = matchingEvents.some(event => {
                    try {
                        const starttid = event.getCellValue(starttidField.name);
                        const sluttid = event.getCellValue(sluttidField.name);
                        
                        // Both Starttid and Sluttid must have values (scheduled)
                        if (!starttid || !sluttid) {
                            return false;
                        }
                        
                        // Check if Starttid falls within the displayed week
                        const startDate = new Date(starttid);
                        return displayedDates.some(displayedDate => {
                            return startDate.toDateString() === displayedDate.toDateString();
                        });
                    } catch (e) {
                        console.error('Error checking event schedule:', e);
                        return false;
                    }
                });
                
                return hasScheduledEventInWeek;
            } catch (e) {
                console.error('Error checking order for scheduled events:', order.id, e);
                return false;
            }
        });
        
        console.log('Orders with scheduled events in week:', {
            totalOrders: orders.length,
            ordersWithScheduledEvents: ordersWithScheduledEvents.length,
            orderIds: ordersWithScheduledEvents.map(o => o.id)
        });
        
        return ordersWithScheduledEvents;
    };

    const filteredOrderRecords = getOrdersWithIngetStatus(orderRecords);

    // Helper function to convert Starttid (number format) to Date object
    // Examples: 1230 = 12:30, 10 = 10:00, 16 = 16:00, 1630 = 16:30
    const convertStarttidToDate = (starttid, date) => {
        if (!starttid && starttid !== 0) return null;
        
        const starttidStr = String(starttid).trim();
        const starttidNum = parseInt(starttidStr, 10);
        if (isNaN(starttidNum)) return null;
        
        let hours, minutes;
        
        // Handle different formats:
        // - Single digit or two digits (1-23): treat as hours only (e.g., "10" = 10:00)
        // - Three or four digits: treat as HHMM format (e.g., "1230" = 12:30, "100" = 1:00)
        if (starttidNum < 100) {
            // Single or two digits: hours only
            hours = starttidNum;
            minutes = 0;
        } else {
            // Three or four digits: HHMM format
            hours = Math.floor(starttidNum / 100);
            minutes = starttidNum % 100;
        }
        
        // Validate hours and minutes
        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            console.warn(`Invalid time: ${starttid} -> ${hours}:${minutes}`);
            return null;
        }
        
        const resultDate = new Date(date);
        resultDate.setHours(hours, minutes, 0, 0);
        
        console.log(`🕐 Converted Starttid "${starttid}" to ${hours}:${minutes.toString().padStart(2, '0')} (${resultDate.toTimeString()})`);
        
        return resultDate;
    };

    // Helper function to parse duration string (e.g., "1:00", "0:20") to minutes
    const parseDurationToMinutes = (durationStr) => {
        if (!durationStr) return 30; // Default 30 minutes
        
        // Handle format like "1:00" or "0:20"
        if (typeof durationStr === 'string') {
            const parts = durationStr.trim().split(':');
            if (parts.length === 2) {
                const hours = parseInt(parts[0], 10) || 0;
                const minutes = parseInt(parts[1], 10) || 0;
                return hours * 60 + minutes;
            }
            // Try parsing as number (minutes)
            const num = parseInt(durationStr, 10);
            if (!isNaN(num)) return num;
        } else if (typeof durationStr === 'number') {
            return durationStr;
        }
        
        return 30; // Default 30 minutes
    };

    // Extract break settings from Mechanics table and create break events
    // Fields: Break, Starttid (from Break), Duration
    const getLunchBreakEventsForMechanicAndDate = (mechanicName, date) => {
        if (!mechanicsTable || !mechanicsRecords || mechanicsRecords.length === 0) {
            console.log('getLunchBreakEventsForMechanicAndDate: No mechanics table or records', {
                hasTable: !!mechanicsTable,
                tableName: mechanicsTable?.name,
                recordsCount: mechanicsRecords?.length || 0
            });
            return [];
        }

        console.log('🔍 Mechanics table info:', {
            tableName: mechanicsTable.name,
            fieldsCount: mechanicsTable.fields.length,
            recordsCount: mechanicsRecords.length
        });

        // Find the name field in Mechanics table to match mechanic by name
        const nameField = mechanicsTable.fields.find(f => 
            f.name === 'Name' || 
            f.name === 'Mechanic Name' ||
            f.name.toLowerCase().includes('name')
        );

        // Log all available fields for debugging
        console.log('🔍 Available fields in Mechanics table:', mechanicsTable.fields.map(f => ({
            name: f.name,
            type: f.type
        })));

        // Find break setting fields in Mechanics table
        // Field names: Break (linked record), Starttid (from Break) (lookup), Duration (lookup)
        const breakField = mechanicsTable.fields.find(f => 
            f.name === 'Break' || 
            f.name.toLowerCase() === 'break'
        );
        const starttidFromBreakField = mechanicsTable.fields.find(f => 
            f.name === 'Starttid (from Break)' ||
            f.name === 'Starttid(from Break)' ||
            f.name.toLowerCase() === 'starttid (from break)' ||
            f.name.toLowerCase().includes('starttid') && f.name.toLowerCase().includes('break')
        );
        const durationField = mechanicsTable.fields.find(f => 
            f.name === 'Duration' ||
            f.name.toLowerCase() === 'duration'
        );
        // Try to find a Name lookup field from Break (if it exists)
        const nameFromBreakField = mechanicsTable.fields.find(f => 
            f.name === 'Name (from Break)' ||
            f.name === 'Name(from Break)' ||
            (f.name.toLowerCase().includes('name') && f.name.toLowerCase().includes('break'))
        );

        console.log('🔍 Found fields:', {
            nameField: nameField?.name || 'NOT FOUND',
            breakField: breakField?.name || 'NOT FOUND',
            starttidFromBreakField: starttidFromBreakField?.name || 'NOT FOUND',
            durationField: durationField?.name || 'NOT FOUND',
            nameFromBreakField: nameFromBreakField?.name || 'NOT FOUND'
        });

        if (!nameField || !breakField || !starttidFromBreakField || !durationField) {
            console.warn('⚠️ Break setting fields not found in Mechanics table:', {
                nameField: nameField?.name || 'NOT FOUND',
                breakField: breakField?.name || 'NOT FOUND',
                starttidFromBreakField: starttidFromBreakField?.name || 'NOT FOUND',
                durationField: durationField?.name || 'NOT FOUND',
                availableFields: mechanicsTable.fields.map(f => `${f.name} (${f.type})`)
            });
            return [];
        }

        console.log(`🔍 Looking for break settings for mechanic: ${mechanicName} on ${date.toDateString()}`);

        // Find the mechanic record by name
        const mechanicRecord = mechanicsRecords.find(mech => {
            if (!nameField) return false;
            const mechName = mech.getCellValueAsString(nameField.name);
            return mechName && mechName.trim().toLowerCase() === mechanicName.trim().toLowerCase();
        });

        if (!mechanicRecord) {
            console.log(`⚠️ Mechanic "${mechanicName}" not found in Mechanics table`);
            return [];
        }

        console.log(`✅ Found mechanic record: ${mechanicRecord.id}`);

        const lunchEvents = [];
        // Track individual lunch entries to avoid exact duplicates
        const seenLunchEntries = new Set(); // Format: "mechanic-name-starttid-duration"

        try {
            // Get cell values - these can be comma-separated strings or arrays
            const breakValue = mechanicRecord.getCellValue(breakField.name);
            const breakStarttidValue = mechanicRecord.getCellValue(starttidFromBreakField.name);
            const breakDurationValue = mechanicRecord.getCellValue(durationField.name);

            // Also try getting as strings for comma-separated format
            const breakValueStr = mechanicRecord.getCellValueAsString(breakField.name) || '';
            const breakStarttidValueStr = mechanicRecord.getCellValueAsString(starttidFromBreakField.name) || '';
            const breakDurationValueStr = mechanicRecord.getCellValueAsString(durationField.name) || '';

            console.log(`📋 Break settings from Mechanics table for ${mechanicName}:`, {
                breakValue: breakValue,
                breakStarttidValue: breakStarttidValue,
                breakDurationValue: breakDurationValue,
                breakValueStr: breakValueStr,
                breakStarttidValueStr: breakStarttidValueStr,
                breakDurationValueStr: breakDurationValueStr,
                fieldTypes: {
                    break: breakField.type,
                    starttid: starttidFromBreakField.type,
                    duration: durationField.type
                }
            });

            // Parse comma-separated strings or handle arrays
            let breakNames = [];
            let starttidValues = [];
            let durationValues = [];

            // Check if values are comma-separated strings (e.g., "Lunch, Coffe break")
            if (breakValueStr && breakValueStr.includes(',')) {
                // Parse comma-separated format
                breakNames = breakValueStr.split(',').map(s => s.trim()).filter(s => s);
                starttidValues = breakStarttidValueStr.split(',').map(s => s.trim()).filter(s => s);
                durationValues = breakDurationValueStr.split(',').map(s => s.trim()).filter(s => s);
                
                console.log(`📝 Parsed comma-separated values:`, {
                    breakNames,
                    starttidValues,
                    durationValues
                });
            } else if (Array.isArray(breakValue)) {
                // Handle linked records array format
                const breakRecords = breakValue;
                const starttidArray = Array.isArray(breakStarttidValue) ? breakStarttidValue : (breakStarttidValue ? [breakStarttidValue] : []);
                const durationArray = Array.isArray(breakDurationValue) ? breakDurationValue : (breakDurationValue ? [breakDurationValue] : []);

                // Get break names - try lookup field if available
                let breakNameValues = null;
                if (nameFromBreakField) {
                    breakNameValues = mechanicRecord.getCellValue(nameFromBreakField.name);
                }
                
                // Process each linked break record
                for (let i = 0; i < breakRecords.length; i++) {
                    // Get break name from lookup field if available
                    let breakName = '';
                    if (breakNameValues) {
                        const nameArray = Array.isArray(breakNameValues) ? breakNameValues : [breakNameValues];
                        if (i < nameArray.length && nameArray[i]) {
                            breakName = String(nameArray[i]);
                        }
                    }
                    
                    // Fallback: use generic name if lookup field not available
                    if (!breakName) {
                        breakName = `Break ${i + 1}`;
                    }
                    
                    breakNames.push(breakName);
                    
                    // Get corresponding starttid and duration values by index
                    if (i < starttidArray.length) {
                        const starttidValue = starttidArray[i];
                        starttidValues.push(String(starttidValue || ''));
                    } else {
                        starttidValues.push('');
                    }
                    
                    if (i < durationArray.length) {
                        const durationValue = durationArray[i];
                        durationValues.push(String(durationValue || ''));
                    } else {
                        durationValues.push('0:30'); // Default duration
                    }
                }
            } else if (breakValue || breakValueStr) {
                // Single value (not comma-separated, not array)
                breakNames = [breakValueStr || String(breakValue || 'Break')];
                starttidValues = [breakStarttidValueStr || String(breakStarttidValue || '')];
                durationValues = [breakDurationValueStr || String(breakDurationValue || '0:30')];
            }

            if (breakNames.length === 0) {
                console.log(`ℹ️ No break settings found for mechanic ${mechanicName}`);
                return [];
            }

            // Ensure all arrays have the same length (pad with empty/default values if needed)
            const maxLength = Math.max(breakNames.length, starttidValues.length, durationValues.length);
            while (breakNames.length < maxLength) {
                breakNames.push(`Break ${breakNames.length + 1}`);
            }
            while (starttidValues.length < maxLength) {
                starttidValues.push('');
            }
            while (durationValues.length < maxLength) {
                durationValues.push('0:30');
            }

            console.log(`📊 Aligned break arrays (length: ${maxLength}):`, {
                breakNames,
                starttidValues,
                durationValues
            });

            // Filter out entries without starttid
            const validEntries = breakNames.map((name, idx) => ({
                name,
                starttid: starttidValues[idx] || '',
                duration: durationValues[idx] || '0:30'
            })).filter(entry => entry.starttid && entry.starttid.trim() !== '');

            if (validEntries.length === 0) {
                console.log(`ℹ️ No valid break settings found for mechanic ${mechanicName} (missing starttid values)`);
                return [];
            }

            console.log(`✅ Found ${validEntries.length} break settings for mechanic ${mechanicName}:`, {
                entries: validEntries.map(e => ({ name: e.name, starttid: e.starttid, duration: e.duration }))
            });

            // Use the filtered valid entries
            const breakNamesFiltered = validEntries.map(e => e.name);
            const starttidValuesFiltered = validEntries.map(e => e.starttid);
            const durationValuesFiltered = validEntries.map(e => e.duration);

            console.log(`📝 Processing ${validEntries.length} break entries for ${mechanicName}...`);

            // Create break events for each break entry
            for (let i = 0; i < validEntries.length; i++) {
                const name = breakNamesFiltered[i] || 'Lunch/Coffee Break';
                const starttidStr = starttidValuesFiltered[i] || null;
                const durationStr = durationValuesFiltered[i] || '0:30';

                console.log(`🔍 Processing entry ${i}:`, {
                    name,
                    starttidStr,
                    durationStr
                });

                if (!starttidStr || starttidStr.trim() === '') {
                    console.log(`⚠️ Skipping entry ${i} - no Starttid value`);
                    continue;
                }

                // Convert Starttid to Date
                const startDate = convertStarttidToDate(starttidStr.trim(), date);
                if (!startDate) {
                    console.log(`⚠️ Skipping entry ${i} - invalid Starttid: "${starttidStr}" (could not convert to date)`);
                    continue;
                }

                // Parse duration and calculate end time
                const durationMinutes = parseDurationToMinutes(durationStr.trim());
                const endDate = new Date(startDate);
                endDate.setMinutes(endDate.getMinutes() + durationMinutes);

                console.log(`✓ Entry ${i} converted successfully:`, {
                    name,
                    starttid: starttidStr,
                    startDate: startDate.toTimeString(),
                    duration: durationStr,
                    durationMinutes,
                    endDate: endDate.toTimeString()
                });

                // Create a unique key for this specific lunch entry to avoid exact duplicates
                const entryKey = `${mechanicName.toLowerCase()}-${name.toLowerCase().trim()}-${starttidStr.trim()}-${durationStr.trim()}`;
                if (seenLunchEntries.has(entryKey)) {
                    console.log(`⏭️ Skipping duplicate entry: "${name}" at ${starttidStr} (already shown)`);
                    continue;
                }
                seenLunchEntries.add(entryKey);
                console.log(`➕ Adding new break entry: "${name}" at ${starttidStr}`);

                console.log(`✨ Creating break event ${i + 1}/${validEntries.length}:`, {
                    name,
                    starttid: starttidStr,
                    duration: durationStr,
                    startTime: startDate.toTimeString(),
                    endTime: endDate.toTimeString(),
                    durationMinutes
                });

                // Create virtual lunch event with unique ID for each separate entry
                const lunchEvent = {
                    id: `lunch-${mechanicName}-${name.replace(/\s+/g, '-')}-${starttidStr}-${date.toISOString()}-${i}-${mechanicRecord.id}`,
                    isLunchBreak: true,
                    getCellValue: (fieldName) => {
                        if (fieldName === 'Starttid' || fieldName.toLowerCase().includes('starttid')) {
                            return startDate;
                        }
                        if (fieldName === 'Sluttid' || fieldName.toLowerCase().includes('sluttid')) {
                            return endDate;
                        }
                        if (fieldName === 'Mekaniker' || fieldName.toLowerCase().includes('mekaniker')) {
                            return [mechanicName];
                        }
                        if (fieldName === 'Arbetsorder beskrivning' || fieldName.toLowerCase().includes('beskrivning')) {
                            return name;
                        }
                        return null;
                    },
                    getCellValueAsString: (fieldName) => {
                        if (fieldName === 'Arbetsorder beskrivning' || fieldName.toLowerCase().includes('beskrivning')) {
                            return name;
                        }
                        if (fieldName === 'Mekaniker' || fieldName.toLowerCase().includes('mekaniker')) {
                            return mechanicName;
                        }
                        return '';
                    }
                };

                lunchEvents.push(lunchEvent);
                console.log(`✅ Created break event: "${name}" at ${startDate.toTimeString()} (${durationMinutes} min) for ${mechanicName}`);
            }
        } catch (e) {
            console.error(`Error processing break settings from Mechanics table for mechanic ${mechanicName}:`, e);
        }

        console.log(`📊 Total break events created for ${mechanicName} on ${date.toDateString()}: ${lunchEvents.length}`);
        return lunchEvents;
    };

    const getEventsForMechanicAndDate = (mechanicName, date) => {
        if (!mechanicName || mechanicName.trim() === '' || mechanicName === 'undefined') {
            return []; // Don't return events for invalid mechanic names
        }
        
        // Normalize the target date to compare only year, month, and day
        const targetDateStart = new Date(date);
        targetDateStart.setHours(0, 0, 0, 0);
        const targetDateEnd = new Date(date);
        targetDateEnd.setHours(23, 59, 59, 999);
        
        // Get regular events from Calendar Events table
        const regularEvents = events.filter(ev => {
            // First check if the event matches the mechanic
            const mekaniker = ev.getCellValue('Mekaniker') || [];
            let matchesMechanic = false;
            
            // Check if any mechanic in the event matches the mechanic name
            if (Array.isArray(mekaniker) && mekaniker.length > 0) {
                matchesMechanic = mekaniker.some(m => {
                    // Try multiple ways to get the mechanic name from the event
                    let eventMechName = '';
                    if (typeof m === 'string') {
                        eventMechName = m;
                    } else if (m && m.name) {
                        eventMechName = m.name;
                    } else if (m && m.value) {
                        eventMechName = m.value;
                    } else if (m) {
                        eventMechName = String(m);
                    }
                    
                    // Compare (case-insensitive and trimmed) - only if we have a valid name
                    if (eventMechName && eventMechName.trim() !== '' && eventMechName !== 'undefined') {
                        return eventMechName.trim().toLowerCase() === mechanicName.trim().toLowerCase();
                    }
                    return false;
                });
            }
            
            if (!matchesMechanic) {
                return false;
            }
            
            // Now check if the event matches the date
            // Get Starttid field to check the date
            const starttid = ev.getCellValue('Starttid');
            if (!starttid) {
                return false; // No Starttid means event can't be scheduled for a specific date
            }
            
            // Convert Starttid to Date if it's not already
            let eventDate = null;
            if (starttid instanceof Date) {
                eventDate = starttid;
            } else if (typeof starttid === 'string' || typeof starttid === 'number') {
                eventDate = new Date(starttid);
            }
            
            if (!eventDate || isNaN(eventDate.getTime())) {
                return false; // Invalid date
            }
            
            // Compare only the date part (year, month, day)
            const eventDateOnly = new Date(eventDate);
            eventDateOnly.setHours(0, 0, 0, 0);
            
            return eventDateOnly.getTime() === targetDateStart.getTime();
        });

        // Get lunch/break events for this mechanic
        const lunchBreakEvents = getLunchBreakEventsForMechanicAndDate(mechanicName, date);

        // Combine regular events and lunch/break events
        return [...regularEvents, ...lunchBreakEvents];
    };

    const statusColors = {
        'Offertförfrågan skickad': '#ef4444', // Red
        'Bokad och skickad till kalender': '#3b82f6', // Blue
        'Pågående arbete': '#f97316', // Orange
        'Arbete klart (inväntar hämtning)': '#14b8a6', // Teal
        'Avslutad': '#22c55e', // Green
        'Inget': '#6b7280' // Gray
    };

    const statusIcons = {
        'Offertförfrågan skickad': 'clock',
        'Bokad och skickad till kalender': 'gear',
        'Pågående arbete': 'wrench',
        'Arbete klart (inväntar hämtning)': 'tire',
        'Avslutad': 'campaign',
        'Inget': 'gear'
    };

    // Handler for order click - replace previous selection with new one
    // If clicking the same order again, keep it selected (don't deselect)
    const handleOrderClick = useCallback((orderNo, event) => {
        // Prevent multiple simultaneous selections
        if (isSelectingOrder.current) {
            console.warn('Selection already in progress, ignoring click');
            return;
        }
        
        // If event is provided and it came from an order detail card, ignore it
        if (event && event.target && event.target.closest('.order-detail-card')) {
            console.log('Click originated from order detail card, ignoring selection');
            return;
        }
        
        // Validate input
        if (!orderNo) {
            console.warn('handleOrderClick called with empty orderNo');
            return;
        }
        
        const orderNoTrimmed = orderNo.toString().trim();
        if (!orderNoTrimmed) {
            console.warn('handleOrderClick called with orderNo that becomes empty after trim:', orderNo);
            return;
        }
        
        console.log('handleOrderClick called with orderNo:', orderNo, 'trimmed:', orderNoTrimmed);
        console.trace('Stack trace for handleOrderClick');
        
        // Set flag to prevent multiple simultaneous selections
        isSelectingOrder.current = true;
        
        // Use functional update to ensure we're working with the latest state
        // Only update top selection (for calendar drag operations)
        setTopSelectedOrderNumbers(prev => {
            console.log('Previous topSelectedOrderNumbers:', Array.from(prev));
            console.log('Previous topSelectedOrderNumbers size:', prev.size);
            
            // If clicking the same order that's already selected, keep it selected
            if (prev.has(orderNoTrimmed)) {
                console.log('Order already selected, keeping selection');
                isSelectingOrder.current = false;
                return prev; // Keep the same selection
            }
            
            // Otherwise, replace with the new order (only one selected at a time)
            // Create a completely new Set to ensure React detects the change
            const newSelection = new Set();
            newSelection.add(orderNoTrimmed);
            console.log('New top selection:', Array.from(newSelection));
            console.log('New top selection size:', newSelection.size);
            
            // Reset flag after a short delay
            setTimeout(() => {
                isSelectingOrder.current = false;
            }, 100);
            
            return newSelection;
        });
    }, []);

    // Handler for closing order detail
    // This handles closing from both top and left panels
    const handleCloseOrder = (orderNo, fromPanel = 'top') => {
        const orderNoTrimmed = orderNo ? orderNo.toString().trim() : '';
        if (fromPanel === 'top') {
            setTopSelectedOrderNumbers(prev => {
            const newSet = new Set(prev);
                newSet.delete(orderNoTrimmed);
            return newSet;
        });
        } else {
            setSideSelectedOrderNumbers(prev => {
                const newSet = new Set(prev);
                newSet.delete(orderNoTrimmed);
                return newSet;
            });
        }
    };

    return (
        <div className="p-4 font-sans w-full h-full bg-white text-gray-900" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
            {/* CALENDAR IMAGES GALLERY - Shows all images from Calendar Events at top */}
            <CalendarImagesGallery events={events} eventsTable={eventsTable} />
            
            {/* TOP SECTION: Navigation Buttons */}
            <div className="flex items-center gap-2 mb-4 flex-nowrap overflow-x-auto">
                <button 
                    onClick={() => goToWeek(-1)}
                    className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm transition-colors"
                >
                    Förra veckan
                </button>
                <button 
                    onClick={() => {
                    const now = new Date();
                    const dayOfWeek = now.getDay();
                    const mondayOffset = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
                    const monday = new Date(now);
                    monday.setDate(now.getDate() + mondayOffset);
                    const friday = new Date(monday);
                    friday.setDate(monday.getDate() + 4);
                    setStartDate(monday.toISOString().split('T')[0]);
                    setEndDate(friday.toISOString().split('T')[0]);
                    }}
                    className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-sm transition-colors"
                >
                    Denna veckan
                </button>
                <button 
                    onClick={() => goToWeek(1)}
                    className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm transition-colors"
                >
                    Nästa vecka
                </button>
            </div>

            {/* Wrap both OrderDetailsPanel and Calendar in DndContext for drag-and-drop */}
            {displayedDates.length === 0 ? (
                <>
                    {/* ORDER DETAILS PANEL - Shows selected orders at top */}
                    {eventsTable && (
                        <OrderDetailsPanel
                            selectedOrderNumbers={topSelectedOrderNumbers}
                            orders={filteredOrderRecords}
                            orderTable={orderTable}
                            calendarEvents={events}
                            eventsTable={eventsTable}
                            onCloseOrder={(orderNo) => handleCloseOrder(orderNo, 'top')}
                            statusColors={statusColors}
                            statusIcons={statusIcons}
                            updatingRecords={updatingRecords}
                            recentlyUpdatedRecords={recentlyUpdatedRecords}
                            onHighlightEvent={handleHighlightEvent}
                        />
                    )}
                    <div className="flex-1 py-10 text-center text-gray-500 flex items-center justify-center" style={{ minWidth: 0 }}>
                        Please select Start Date and End Date to view the calendar.
                    </div>
                </>
            ) : (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={(event) => console.log('Drag started:', event.active.id)}
                    onDragEnd={handleDragEnd}
                >
                    {/* ORDER DETAILS PANEL - Shows selected orders at top */}
                    {eventsTable && (
                        <OrderDetailsPanel
                            selectedOrderNumbers={topSelectedOrderNumbers}
                            orders={filteredOrderRecords}
                            orderTable={orderTable}
                            calendarEvents={events}
                            eventsTable={eventsTable}
                            onCloseOrder={(orderNo) => handleCloseOrder(orderNo, 'top')}
                            statusColors={statusColors}
                            statusIcons={statusIcons}
                            updatingRecords={updatingRecords}
                            recentlyUpdatedRecords={recentlyUpdatedRecords}
                        />
                    )}

                    {/* MAIN BLOCK: Calendar Container with Order List */}
                    <div 
                        className="flex gap-0 w-full" 
                        style={{ 
                            height: 'calc(100vh - 120px)', 
                            minHeight: '600px', 
                            maxHeight: 'calc(100vh - 120px)', 
                            width: '100%',
                            position: 'relative',
                            overflow: 'visible'
                        }}
                    >
                        {/* LEFT SIDE: Order Details Panel (vertical layout, no Visualization) */}
                        {eventsTable && orderRecords && (
                            <div 
                                className="flex-shrink-0 bg-white"
                                style={{ 
                                    width: '175px',
                                    minWidth: '175px',
                                    height: '100%',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px',
                                }}
                            >
                                <LeftSideOrderDetailsPanel
                                        orders={orderRecords}
                                    orderTable={orderTable}
                                    calendarEvents={events}
                                    eventsTable={eventsTable}
                                    onCloseOrder={(orderNo) => handleCloseOrder(orderNo, 'side')}
                                    statusColors={statusColors}
                                    statusIcons={statusIcons}
                                    updatingRecords={updatingRecords}
                                    recentlyUpdatedRecords={recentlyUpdatedRecords}
                                    onHighlightEvent={handleHighlightEvent}
                                />
                            </div>
                        )}
                        
                        <div className="relative rounded-l-lg overflow-hidden flex-1" style={{ overflowY: 'auto', overflowX: 'auto', border: '1px solid rgb(229, 231, 235)', borderRight: 'none', height: '100%' }}>
                        {/* MAIN CALENDAR SECTION */}
                        <div className="flex overflow-x-auto">
                        
                        {/* LEFT SIDEBAR: Time Column */}
                        <div className="left-sidebar flex-shrink-0 border-r border-gray-200 bg-gray-50" style={{ marginTop: `${headerHeight + dateRowHeight}px` }}>
                        {hours.map((hour, i) => (
                                <div 
                                    key={i} 
                                    className="time-cell border-b border-gray-200 text-xs text-gray-500 text-right pr-2 py-1"
                                    style={{ height: `${hourHeight}px` }}
                                >
                                    {hour}
                                </div>
                        ))}
                    </div>

                        {/* MAIN SECTION: Mechanic Sub-Calendars */}
                        <div className="main-section flex gap-3">
                            {mechanics.map((mech, mechIndex) => (
                                <div 
                                    key={`mechanic-${mech.name}`} 
                                    className="mechanic-sub-calendar flex-none border border-gray-200 bg-white"
                                    style={{ width: `${displayedDates.length * cellWidth}px` }}
                                >
                                    
                                    {/* MECHANIC HEADER: Avatar + Name */}
                                    <div 
                                        className="mechanic-header bg-white flex items-center justify-center gap-2 border-b border-gray-200"
                                        style={{ 
                                            position: 'sticky',
                                            top: 0,
                                            zIndex: 30,
                                            height: `${headerHeight}px`,
                                            display: 'flex',
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px'
                                        }}
                                    >
                                        {mech.profileUrl ? (
                                            <img 
                                                src={mech.profileUrl} 
                                                alt={`${mech.name} Profile`}
                                                style={{
                                                    width: '32px',
                                                    height: '32px',
                                                    borderRadius: '50%',
                                                    objectFit: 'cover',
                                                    flexShrink: 0
                                                }}
                                            />
                                        ) : (
                                            <div 
                                                style={{
                                                    width: '32px',
                                                    height: '32px',
                                                    borderRadius: '50%',
                                                    backgroundColor: '#e5e7eb',
                                                    flexShrink: 0,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '12px',
                                                    color: '#6b7280'
                                                }}
                                            >
                                                {mech.name ? mech.name.charAt(0).toUpperCase() : '?'}
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                            <h3 className="m-0 text-sm font-semibold" style={{ margin: 0 }}>{mech.name}</h3>
                                            {mech.priority !== null && mech.priority !== undefined && (
                                                <span style={{ 
                                                    fontSize: '10px', 
                                                    color: '#6b7280',
                                                    fontWeight: '500'
                                                }}>
                                                    Priority: {mech.priority}
                                                </span>
                                            )}
                                        </div>
                                </div>

                                    {/* SUB HEADER: Day Names */}
                                    <div 
                                        className="day-header bg-white border-b border-gray-200 font-semibold text-center grid"
                                        style={{ 
                                    position: 'sticky',
                                    top: `${headerHeight}px`,
                                            zIndex: 20,
                                            gridTemplateColumns: `repeat(${displayedDates.length}, 1fr)`,
                                            height: `${dateRowHeight}px`
                                        }}
                                    >
                                    {displayedDates.map(date => (
                                            <div 
                                                key={date.toDateString()} 
                                                className="day-cell border-r border-gray-200 flex items-center justify-center"
                                            >
                                                {formatShortDate(date)}
                                            </div>
                                    ))}
                                </div>

                                    {/* MAIN CALENDAR CELLS: Time Grid */}
                                    <div 
                                        className="calendar-grid grid"
                                        style={{ gridTemplateColumns: `repeat(${displayedDates.length}, 1fr)` }}
                                    >
                                    {displayedDates.map(date => (
                                            <div key={date.toDateString()} className="date-column relative">
                                            {hours.map((hour, i) => (
                                                    <DroppableCell
                                                        key={i}
                                                        mechanicName={mech.name}
                                                        date={date}
                                                        hourIndex={i}
                                                        hourHeight={hourHeight}
                                                    />
                                                ))}

                                                {/* EVENTS: Overlay on calendar cells */}
                                            {getEventsForMechanicAndDate(mech.name, date).map(ev => {
                                                // Get Starttid and Sluttid from event
                                                // For lunch/break events, these come from getCellValue
                                                // For regular events, try to get from fields
                                                let start = null;
                                                let end = null;
                                                
                                                // Try to get Starttid
                                                const starttid = ev.getCellValue('Starttid');
                                                if (starttid) {
                                                    start = starttid instanceof Date ? starttid : new Date(starttid);
                                                }
                                                
                                                // Try to get Sluttid
                                                const sluttid = ev.getCellValue('Sluttid');
                                                if (sluttid) {
                                                    end = sluttid instanceof Date ? sluttid : new Date(sluttid);
                                                }
                                                
                                                // If no time fields found, skip this event (unless it's a lunch break which should have them)
                                                if (!start || !end) {
                                                    // Check if it's a lunch break event - these should always have times
                                                    if (ev.isLunchBreak === true) {
                                                        console.warn('Lunch break event missing Starttid or Sluttid:', ev.id);
                                                    }
                                                    return null;
                                                }
                                                
                                                // Adjust for 05:00-19:00 time range (subtract 5 hours from start time)
                                                const adjustedStartHour = start.getHours() - 5;
                                                const adjustedEndHour = end.getHours() - 5;
                                                
                                                // Only show events that fall within our 05:00-19:00 range
                                                if (adjustedStartHour < 0 || adjustedStartHour >= 15) {
                                                    return null;
                                                }
                                                
                                                const top = adjustedStartHour * hourHeight + (start.getMinutes() / 60) * hourHeight;
                                                const height = ((end - start) / (1000 * 60 * 60)) * hourHeight;

                                                // Check if this is a lunch/break event - use green color
                                                const isLunchBreak = ev.isLunchBreak === true;
                                                const status = ev.getCellValue('Order Status')?.[0]?.value || 'Inget';
                                                // Use green color (#22c55e) for lunch/break events, otherwise use status color
                                                const backgroundColor = isLunchBreak ? '#22c55e' : (statusColors[status] || '#6b7280');
                                                const statusIcon = statusIcons[status] || '❓';

                                                // For lunch/break events, don't allow expansion (they're virtual events)
                                                const handleExpand = isLunchBreak ? () => {} : expandRecord;

                                                return (
                                                    <DraggableEvent
                                                        key={ev.id}
                                                        event={ev}
                                                        top={top}
                                                        height={height}
                                                        backgroundColor={backgroundColor}
                                                        onExpand={handleExpand}
                                                        isUpdating={updatingRecords.has(ev.id)}
                                                        isRecentlyUpdated={recentlyUpdatedRecords.has(ev.id)}
                                                        status={status}
                                                        statusIcon={statusIcon}
                                                        highlightedEvent={highlightedEvent}
                                                        eventsTable={eventsTable}
                                                        setUpdatingRecords={setUpdatingRecords}
                                                    />
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                        </div>
                        </div>
                        </div>
                        
                        {/* RIGHT SIDE: Order List Panel - ALWAYS VISIBLE */}
                        {(() => {
                            console.log('Rendering OrderList component in main render');
                            console.log('filteredOrderRecords:', filteredOrderRecords.length);
                            console.log('orderTable:', orderTable?.name);
                            return (
                                <OrderList 
                                orders={filteredOrderRecords}
                                    orderTable={orderTable}
                                selectedOrderNumbers={topSelectedOrderNumbers}
                                    onOrderClick={handleOrderClick}
                                />
                            );
                        })()}
                    </div>
                </DndContext>
            )}
        </div>
    );
}

initializeBlock({ interface: () => <CalendarInterfaceExtension /> });
